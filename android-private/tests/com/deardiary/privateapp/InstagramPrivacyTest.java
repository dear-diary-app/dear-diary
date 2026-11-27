package com.deardiary.privateapp;
import android.webkit.*;import android.widget.LinearLayout;import java.lang.reflect.*;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.Config;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)@Config(sdk=28,manifest=Config.NONE)
public class InstagramPrivacyTest{
 InstagramActivity a;FakeWeb w;
 static class FakeWeb extends WebView{boolean stopped,paused,destroyed,blank;FakeWeb(InstagramActivity a){super(a);}@Override public void stopLoading(){stopped=true;}@Override public void onPause(){paused=true;}@Override public void loadUrl(String u){blank="about:blank".equals(u);}@Override public void destroy(){destroyed=true;}}
 void set(String n,Object v)throws Exception{Field f=InstagramActivity.class.getDeclaredField(n);f.setAccessible(true);f.set(a,v);}
 @Before public void setup()throws Exception{a=Robolectric.buildActivity(InstagramActivity.class).get();w=new FakeWeb(a);new LinearLayout(a).addView(w);set("web",w);set("started",true);}
 @Test public void backgroundPausesButKeepsPage()throws Exception{a.onPause();assertTrue(w.paused);assertFalse(w.stopped||w.blank||w.destroyed);assertFalse(a.isFinishing());}
 @Test public void stateSaveKeepsScreen(){a.onSaveInstanceState(new android.os.Bundle());assertFalse(w.blank||w.destroyed);assertFalse(a.isFinishing());}
 @Test public void backAtStartCloses(){a.onBackPressed();assertTrue(w.blank&&w.destroyed);}
 @Test public void noCallerCannotOpen(){InstagramActivity x=Robolectric.buildActivity(InstagramActivity.class).create().get();assertTrue(x.isFinishing());}
}
