package com.deardiary.privateapp;
/** In-memory only. Never persists across Activity recreation or process death. */
final class InstagramReturnTicket{
 static final long MAX_MS=10*60*1000;
 private String token="";private long issued;
 void issue(String value,long now){token=value;issued=now;}
 void clear(){token="";issued=0;}
 boolean consume(String value,long now,boolean safe){boolean ok=safe&&!token.isEmpty()&&token.equals(value)&&now>=issued&&now-issued<MAX_MS;clear();return ok;}
}
