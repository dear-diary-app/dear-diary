package com.deardiary.privateapp;
import android.webkit.*;import android.widget.LinearLayout;import java.lang.reflect.*;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.Config;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)@Config(sdk=28,manifest=Config.NONE,qualifiers="mdpi")@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.NATIVE)
public class InstagramPrivacyTest{
 InstagramActivity a;FakeWeb w;
 static class FakeWeb extends WebView{boolean stopped,paused,destroyed,blank,history,back;FakeWeb(InstagramActivity a){super(a);}@Override public boolean canGoBack(){return history;}@Override public void goBack(){back=true;}@Override public void stopLoading(){stopped=true;}@Override public void onPause(){paused=true;}@Override public void loadUrl(String u){blank="about:blank".equals(u);}@Override public void destroy(){destroyed=true;}}
 void set(String n,Object v)throws Exception{Field f=InstagramActivity.class.getDeclaredField(n);f.setAccessible(true);f.set(a,v);}
 @Before public void setup()throws Exception{a=Robolectric.buildActivity(InstagramActivity.class).get();w=new FakeWeb(a);new LinearLayout(a).addView(w);set("web",w);set("started",true);}
 @Test public void backgroundPausesButKeepsPage()throws Exception{a.onPause();assertTrue(w.paused);assertFalse(w.stopped||w.blank||w.destroyed);assertFalse(a.isFinishing());}
 @Test public void stateSaveKeepsScreen(){a.onSaveInstanceState(new android.os.Bundle());assertFalse(w.blank||w.destroyed);assertFalse(a.isFinishing());}
 @Test public void backAtStartCloses(){a.onBackPressed();assertTrue(w.blank&&w.destroyed);}
 @Test public void noCallerCannotOpen(){InstagramActivity x=Robolectric.buildActivity(InstagramActivity.class).create().get();assertTrue(x.isFinishing());}
 @Test public void backNavigatesBeforeExit(){w.history=true;a.onBackPressed();assertTrue(w.back);assertFalse(a.isFinishing());assertFalse(w.destroyed);}
 @Test public void keyboardAndNavigationUseLargerInset(){assertEquals(300,InstagramActivity.safeBottom(24,300));assertEquals(48,InstagramActivity.safeBottom(48,0));}
 @Test public void reelsStillHasNoSecureFlag(){assertEquals(0,a.getWindow().getAttributes().flags&android.view.WindowManager.LayoutParams.FLAG_SECURE);}
 @Test public void nativeNavHasFiveActions(){final String[] chosen={""};InstagramNav nav=new InstagramNav(a,false,key->chosen[0]=key);assertEquals(5,nav.getChildCount());nav.getChildAt(0).performClick();assertEquals("home",chosen[0]);nav.getChildAt(3).performClick();assertEquals("reels",chosen[0]);}
 @Test public void renderNativeNav()throws Exception{for(boolean dark:new boolean[]{false,true}){InstagramNav nav=new InstagramNav(a,dark,key->{});nav.measure(android.view.View.MeasureSpec.makeMeasureSpec(390,android.view.View.MeasureSpec.EXACTLY),android.view.View.MeasureSpec.makeMeasureSpec(76,android.view.View.MeasureSpec.EXACTLY));nav.layout(0,0,390,76);android.graphics.Bitmap image=android.graphics.Bitmap.createBitmap(390,76,android.graphics.Bitmap.Config.ARGB_8888);nav.draw(new android.graphics.Canvas(image));try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(System.getProperty("java.io.tmpdir"),"native-reels-nav-"+(dark?"dark":"light")+".png"))){image.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}}}
}
