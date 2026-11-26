package com.deardiary.privateapp;
import android.Manifest;import android.app.Application;import android.net.Uri;import android.webkit.*;import java.lang.reflect.*;import java.time.Duration;
import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.Config;import org.robolectric.shadows.ShadowLooper;import static org.junit.Assert.*;import static org.robolectric.Shadows.shadowOf;
@RunWith(RobolectricTestRunner.class)@Config(sdk=28,manifest=Config.NONE)
public class MediaPermissionTest {
 MainActivity activity;FakeWeb web;FakeRequest request;
 static class FakeWeb extends WebView{boolean ready=true;String url="https://dear-diary-app.github.io/dear-diary/#/chat";FakeWeb(MainActivity a){super(a);}@Override public String getUrl(){return url;}@Override public void evaluateJavascript(String script,ValueCallback<String> c){if(c!=null)c.onReceiveValue(ready?"true":"false");}}
 static class FakeRequest extends PermissionRequest{int grants=0,denials=0;String[] granted;public Uri getOrigin(){return Uri.parse("https://dear-diary-app.github.io");}public String[] getResources(){return new String[]{RESOURCE_AUDIO_CAPTURE};}public void grant(String[] r){grants++;granted=r;}public void deny(){denials++;}}
 void set(String key,Object value)throws Exception{Field f=MainActivity.class.getDeclaredField(key);f.setAccessible(true);f.set(activity,value);}
 void run(String key)throws Exception{Method m=MainActivity.class.getDeclaredMethod(key);m.setAccessible(true);m.invoke(activity);}
 @Before public void setup()throws Exception{activity=Robolectric.buildActivity(MainActivity.class).get();web=new FakeWeb(activity);request=new FakeRequest();set("web",web);set("unlocked",true);set("mediaRequest",request);set("mediaUrl",web.url);set("mediaPermissionReady",true);MainActivity.foreground=true;shadowOf((Application)activity.getApplication()).grantPermissions(Manifest.permission.RECORD_AUDIO,Manifest.permission.MODIFY_AUDIO_SETTINGS);}
 @After public void cleanup(){MainActivity.foreground=false;}
 @Test public void approvedAudioOnly()throws Exception{run("finishMedia");assertEquals(1,request.grants);assertArrayEquals(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE},request.granted);}
 @Test public void webRenderRaceRetries()throws Exception{web.ready=false;run("finishMedia");assertEquals(0,request.grants);web.ready=true;ShadowLooper.idleMainLooper(151,java.util.concurrent.TimeUnit.MILLISECONDS);assertEquals(1,request.grants);}
 @Test public void backgroundWaitsForResume()throws Exception{MainActivity.foreground=false;run("finishMedia");assertEquals(0,request.grants);MainActivity.foreground=true;run("finishMedia");assertEquals(1,request.grants);}
 @Test public void nativeLockedDoesNotGrant()throws Exception{set("unlocked",false);run("finishMedia");assertEquals(0,request.grants);}
 @Test public void routeChangeDenied()throws Exception{web.url+="/other";run("finishMedia");assertEquals(1,request.denials);assertEquals(0,request.grants);}
 @Test public void friendModeDenied()throws Exception{activity.getSharedPreferences("push",0).edit().putBoolean("friend_mode",true).commit();run("finishMedia");assertEquals(1,request.denials);}
 @Test public void androidDeniedDoesNotGrant()throws Exception{shadowOf((Application)activity.getApplication()).denyPermissions(Manifest.permission.RECORD_AUDIO);run("finishMedia");assertEquals(1,request.denials);assertEquals(0,request.grants);}
 @Test public void missingAudioSettingsDenied()throws Exception{shadowOf((Application)activity.getApplication()).denyPermissions(Manifest.permission.MODIFY_AUDIO_SETTINGS);run("finishMedia");assertEquals(1,request.denials);assertEquals(0,request.grants);}
 @Test public void timeoutDeniesAndClears()throws Exception{Method m=MainActivity.class.getDeclaredMethod("denyMedia",String.class);m.setAccessible(true);m.invoke(activity,"MIC-TIMEOUT");run("finishMedia");assertEquals(1,request.denials);assertEquals(0,request.grants);}
}
