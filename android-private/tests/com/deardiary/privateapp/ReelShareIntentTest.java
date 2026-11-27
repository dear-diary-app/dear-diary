package com.deardiary.privateapp;
import android.content.*;import android.net.Uri;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.Config;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)@Config(sdk=28,manifest=Config.NONE)
public class ReelShareIntentTest{
 Intent share(String text){return new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,text);}
 @Test public void acceptsOneReelWithCaptionButDropsEverythingElse(){assertEquals("https://www.instagram.com/reel/ABC_123/",ReelShareActivity.parse(share("Watch this reel\nhttps://instagram.com/reel/ABC_123/?igsh=tracking")));}
 @Test public void rejectsOtherContent(){for(String s:new String[]{"hello","https://evil.test/reel/ABC/","https://instagram.com/p/ABC/","https://instagram.com/reel/A/ https://instagram.com/reel/B/","https://instagram.com/reel/A/ https://evil.test","https://user@instagram.com/reel/A/"})assertNull(s,ReelShareActivity.parse(share(s)));}
 @Test public void rejectsStreamAndWrongAction(){assertNull(ReelShareActivity.parse(share("https://instagram.com/reel/A/").putExtra(Intent.EXTRA_STREAM,Uri.parse("content://test/file"))));assertNull(ReelShareActivity.parse(new Intent(Intent.ACTION_VIEW,Uri.parse("https://instagram.com/reel/A/"))));assertNull(ReelShareActivity.parse(share("https://instagram.com/reel/A/").setType("image/jpeg")));}
 @Test public void unconfiguredTargetFinishesWithoutOpeningDiary(){ReelShareActivity a=Robolectric.buildActivity(ReelShareActivity.class,share("https://instagram.com/reel/A/")).create().get();assertTrue(a.isFinishing());assertNull(Shadows.shadowOf(a).getNextStartedActivity());assertFalse(ReelShareStore.enabled(a));}
}
