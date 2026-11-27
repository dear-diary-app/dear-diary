package com.deardiary.privateapp;
import android.webkit.*;import java.lang.reflect.*;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.Config;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)@Config(sdk=28,manifest=Config.NONE)
public class InstagramGateTest{
 MainActivity a;FakeWeb web;
 static class FakeWeb extends WebView{String url="https://dear-diary-app.github.io/dear-diary/#/instagram";boolean ready=true;FakeWeb(MainActivity a){super(a);}@Override public String getUrl(){return url;}@Override public void evaluateJavascript(String s,ValueCallback<String> cb){if(cb!=null)cb.onReceiveValue(ready?"true":"false");}}
 void set(String k,Object v)throws Exception{Field f=MainActivity.class.getDeclaredField(k);f.setAccessible(true);f.set(a,v);}
 @Before public void setup()throws Exception{a=Robolectric.buildActivity(MainActivity.class).get();web=new FakeWeb(a);set("web",web);set("unlocked",true);MainActivity.foreground=true;}
 @After public void done(){MainActivity.foreground=false;}
 @Test public void acceptsOnlyDedicatedUnlockedRoute(){assertTrue(a.canOpenInstagram());web.url="https://dear-diary-app.github.io/dear-diary/#/chat";assertFalse(a.canOpenInstagram());}
 @Test public void lockedRejected()throws Exception{set("unlocked",false);assertFalse(a.canOpenInstagram());}
 @Test public void backgroundRejected(){MainActivity.foreground=false;assertFalse(a.canOpenInstagram());}
 @Test public void friendModeRejected(){a.getSharedPreferences("push",0).edit().putBoolean("friend_mode",true).commit();assertFalse(a.canOpenInstagram());}
 @Test public void loginBusyRejected()throws Exception{set("authenticating",true);assertFalse(a.canOpenInstagram());}
 @Test public void untrustedOriginsRejected(){for(String u:new String[]{"https://www.instagram.com/#/instagram","https://dear-diary-app.github.io.evil.test/dear-diary/#/instagram","http://dear-diary-app.github.io/dear-diary/#/instagram","https://dear-diary-app.github.io/other/#/instagram"}){web.url=u;assertFalse(a.canOpenInstagram());}}
 @Test public void webGateNotReadyDoesNotLaunch()throws Exception{web.ready=false;Method m=MainActivity.class.getDeclaredMethod("openInstagram");m.setAccessible(true);m.invoke(a);assertNull(org.robolectric.Shadows.shadowOf(a).getNextStartedActivity());}
}
