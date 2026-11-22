"""Generate the native emoji catalogue and server allowlist from Unicode 17 emoji-test.txt.
Usage: python3 scripts/build-emoji-data.py /path/to/emoji-test.txt
Source: https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt
"""
import sys,json,re,gzip
from pathlib import Path
mapping={'Smileys & Emotion':'Smileys & People','People & Body':'Smileys & People','Animals & Nature':'Animals','Food & Drink':'Food','Activities':'Activity','Travel & Places':'Travel','Objects':'Objects','Symbols':'Symbols','Flags':'Flags'}
groups={k:[] for k in ['Smileys & People','Animals','Food','Activity','Travel','Objects','Symbols','Flags']};valid=set();group=''
for line in Path(sys.argv[1]).read_text().splitlines():
 if line.startswith('# group: '):group=line[9:]
 if ';' not in line or '#' not in line or group not in mapping:continue
 codes,tail=line.split(';',1);status,comment=tail.split('#',1);status=status.strip()
 if status not in ['fully-qualified','minimally-qualified','unqualified']:continue
 emoji=''.join(chr(int(x,16)) for x in codes.split());valid.add(emoji)
 if status=='fully-qualified':
  name=re.sub(r'^\S+\s+E[\d.]+\s+','',comment.strip());groups[mapping[group]].append([emoji,name])
data=json.dumps([[g,rows]for g,rows in groups.items()],ensure_ascii=False,separators=(',',':'))
Path('src/emoji-data.json').write_text(data+'\n')
head="""-- Unicode 17 emoji sequences, including presentation-selector variants.
-- Each allowed value is one standardized emoji grapheme, not arbitrary text.
-- Source: https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt
create table public.chat_emoji (emoji text primary key check (char_length(emoji) between 1 and 32 and octet_length(emoji) <= 128));
alter table public.chat_emoji enable row level security;
revoke all on public.chat_emoji from anon, authenticated;
insert into public.chat_emoji (emoji) values
"""
body=',\n'.join("('"+e.replace("'","''")+"')" for e in sorted(valid))+';\n'
foot="""create or replace function public.chat_react(p_id uuid, p_emoji text) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;
  if p_emoji is not null and p_emoji <> '' and
     (char_length(p_emoji) > 32 or octet_length(p_emoji) > 128 or not exists (select 1 from public.chat_emoji e where e.emoji = p_emoji))
     then raise exception 'Choose one emoji'; end if;
  update public.chat_messages m
     set reactions = case when p_emoji is null or p_emoji = '' or m.reactions ->> uid::text = p_emoji
                          then m.reactions - uid::text
                          else m.reactions || jsonb_build_object(uid::text, p_emoji) end
   where m.id = p_id and (m.sender_id = uid or m.recipient_id = uid);
end $$;
revoke all on function public.chat_react(uuid, text) from public, anon;
grant execute on function public.chat_react(uuid, text) to authenticated;
"""
Path('supabase/migrations/0020_chat_emoji.sql').write_text(head+body+foot)
print('Fully-qualified emoji:',sum(map(len,groups.values())),'allowed sequences:',len(valid),'JSON bytes:',len(data.encode()),'gzip bytes:',len(gzip.compress(data.encode())))
