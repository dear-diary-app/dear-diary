package com.deardiary.privateapp;
import android.webkit.*;import java.lang.reflect.*;import java.util.*;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.Config;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)@Config(sdk=28,manifest=Config.NONE)
public class WebTimerLifecycleTest{
 static class Probe extends WebView{
  List<String> calls=new ArrayList<>();Probe(android.content.Context c){super(c);}
  @Override public void pauseTimers(){calls.add("stop");}
  @Override public void resumeTimers(){calls.add("start");}
  @Override public void onResume(){calls.add("resume");}
  @Override public String getUrl(){return "https://dear-diary-app.github.io/dear-diary/#/instagram";}
  @Override public void evaluateJavascript(String s,ValueCallback<String> cb){calls.add("js");if(cb!=null)cb.onReceiveValue("false");}
 }
 void set(Object a,String name,Object value)throws Exception{Field f=a.getClass().getDeclaredField(name);f.setAccessible(true);f.set(a,value);}
 @Test public void stoppedDiaryPausesAndStartResumesTimers()throws Exception{MainActivity a=Robolectric.buildActivity(MainActivity.class).get();Probe p=new Probe(a);set(a,"web",p);a.onStop();a.onStart();assertEquals(Arrays.asList("stop","start"),p.calls);}
 @Test public void stoppedInstagramPausesAndStartResumesTimers()throws Exception{InstagramActivity a=Robolectric.buildActivity(InstagramActivity.class).get();Probe p=new Probe(a);set(a,"web",p);a.onStop();a.onStart();assertEquals(Arrays.asList("stop","start"),p.calls);}
 @Test public void returnHandshakeResumesTimersBeforeJavascript()throws Exception{MainActivity a=Robolectric.buildActivity(MainActivity.class).get();Probe p=new Probe(a);set(a,"web",p);set(a,"shield",new LockScreen(a,false,()->{},()->{},()->{}));Field f=MainActivity.class.getDeclaredField("instagramTicket");f.setAccessible(true);((InstagramReturnTicket)f.get(a)).issue("test",android.os.SystemClock.elapsedRealtime());MainActivity.foreground=false;a.onNewIntent(new android.content.Intent().putExtra("instagram_return",true).putExtra("tab","home").putExtra("continuous",true).putExtra("return_ticket","test"));assertEquals(Arrays.asList("start","resume","js"),p.calls);}
 @Test public void pausedButVisibleInstagramDoesNotStopGlobalTimers()throws Exception{InstagramActivity a=Robolectric.buildActivity(InstagramActivity.class).get();Probe p=new Probe(a);set(a,"web",p);a.onPause();assertFalse(p.calls.contains("stop"));}
 @Test public void missingWebViewLifecycleIsSafe(){MainActivity a=Robolectric.buildActivity(MainActivity.class).get();a.onStop();a.onStart();InstagramActivity b=Robolectric.buildActivity(InstagramActivity.class).get();b.onStop();b.onStart();}
 @Test public void recreatingActivityStillResumesProcessTimers()throws Exception{MainActivity old=Robolectric.buildActivity(MainActivity.class).get();Probe p=new Probe(old);set(old,"web",p);old.onStop();MainActivity fresh=Robolectric.buildActivity(MainActivity.class).get();Probe q=new Probe(fresh);set(fresh,"web",q);fresh.onStart();assertEquals(Arrays.asList("start"),q.calls);}
}
