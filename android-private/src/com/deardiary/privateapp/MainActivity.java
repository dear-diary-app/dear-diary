package com.deardiary.privateapp;

import android.Manifest;
import android.app.*;
import android.hardware.biometrics.BiometricPrompt;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.util.*;
import org.json.*;
import androidx.webkit.*;
import com.google.firebase.messaging.FirebaseMessaging;

public final class MainActivity extends Activity {
 private static final String HOME="https://dear-diary-app.github.io/dear-diary/";
 private WebView web; private FrameLayout root; private LinearLayout shield;
 private ValueCallback<Uri[]> fileCallback; private PermissionRequest mediaRequest;
 public static volatile boolean foreground=false; private String pendingRoute="";
 private boolean unlocked=false,authenticating=false,externalFlow=false; private CancellationSignal biometricCancel;
 private boolean trusted(Uri u){return u!=null&&u.getPath()!=null&&"https".equals(u.getScheme())&&"dear-diary-app.github.io".equals(u.getHost())&&(u.getPath().equals("/dear-diary")||u.getPath().startsWith("/dear-diary/"));}
 private boolean gateEnabled(){return getPreferences(0).getBoolean("biometric",false);}
 @Override public void onCreate(Bundle state){super.onCreate(state);
  getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
  if(Build.VERSION.SDK_INT>=33)setRecentsScreenshotEnabled(false);
  getWindow().setStatusBarColor(Color.rgb(240,245,236));getWindow().setNavigationBarColor(Color.rgb(240,245,236));
  pendingRoute=safeRoute(getIntent().getStringExtra("route"));
  root=new FrameLayout(this);setContentView(root);root.setOnApplyWindowInsetsListener((v,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);}else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});web=new WebView(this);FrameLayout.LayoutParams wp=new FrameLayout.LayoutParams(-1,-1);wp.topMargin=(int)(36*getResources().getDisplayMetrics().density);root.addView(web,wp);
  web.setFilterTouchesWhenObscured(true);WebView.setWebContentsDebuggingEnabled(false);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setMediaPlaybackRequiresUserGesture(true);s.setGeolocationEnabled(false);s.setSupportMultipleWindows(false);
  CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  if(Build.VERSION.SDK_INT>=26)s.setSafeBrowsingEnabled(true);
  if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
   WebViewCompat.addWebMessageListener(web,"DearDiaryAndroid",Collections.singleton("https://dear-diary-app.github.io"),(view,message,origin,mainFrame,reply)->{
    if(!mainFrame||!trusted(Uri.parse(view.getUrl())))return;
    try{JSONObject data=new JSONObject(message.getData());String op=data.optString("op");
     if(op.equals("bind")){String uid=data.optString("uid");if(!uid.matches("[0-9a-f-]{36}"))return;getSharedPreferences("push",0).edit().putString("uid",uid).apply();pushToken();}
     if(op.equals("unbind")){getSharedPreferences("push",0).edit().remove("uid").apply();((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).cancelAll();}
     if(op.equals("ready")){pushToken();}
    }catch(Exception ignored){}
   });
  }
  web.setWebViewClient(new WebViewClient(){
   @Override public void onPageFinished(WebView v,String url){if(trusted(Uri.parse(url))){if(!pendingRoute.isEmpty()){web.evaluateJavascript("location.hash="+JSONObject.quote(pendingRoute),null);pendingRoute="";}pushToken();}}

   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();if(trusted(u))return false;if("https".equals(u.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){externalFlow=false;}}return true;}
   @Override public void onReceivedSslError(WebView v,android.webkit.SslErrorHandler h,android.net.http.SslError e){h.cancel();}
   @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame())Toast.makeText(MainActivity.this,"Connection failed. Check internet, then use Reload in the app menu.",Toast.LENGTH_LONG).show();}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> c,FileChooserParams p){if(!trusted(Uri.parse(v.getUrl())))return false;if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=c;try{Intent i=p.createIntent();i.addCategory(Intent.CATEGORY_OPENABLE);externalFlow=true;startActivityForResult(i,81);return true;}catch(Exception e){externalFlow=false;fileCallback=null;c.onReceiveValue(null);return false;}}
   @Override public void onPermissionRequest(PermissionRequest r){runOnUiThread(()->{if(!trusted(Uri.parse(web.getUrl()))||!("https".equals(r.getOrigin().getScheme())&&"dear-diary-app.github.io".equals(r.getOrigin().getHost()))){r.deny();return;}if(mediaRequest!=null){r.deny();return;}mediaRequest=r;ArrayList<String> needed=new ArrayList<>();for(String x:r.getResources()){if(x.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)needed.add(Manifest.permission.RECORD_AUDIO);if(x.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)&&checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED)needed.add(Manifest.permission.CAMERA);}if(needed.isEmpty())finishMedia();else{externalFlow=true;requestPermissions(needed.toArray(new String[0]),82);}});}
   @Override public void onPermissionRequestCanceled(PermissionRequest r){if(mediaRequest==r)mediaRequest=null;}
  });
  shield=new LinearLayout(this);shield.setOrientation(1);shield.setGravity(Gravity.CENTER);shield.setPadding(32,32,32,32);shield.setBackgroundColor(Color.rgb(240,245,236));TextView title=new TextView(this);title.setText("Dear Diary\nApp locked");title.setTextSize(24);title.setGravity(Gravity.CENTER);shield.addView(title);Button unlock=new Button(this);unlock.setText("Unlock with device");unlock.setOnClickListener(v->authenticate());shield.addView(unlock);TextView help=new TextView(this);help.setText("Use your phone screen lock if fingerprint is unavailable.\nYour separate diary PIN is still required inside.");help.setGravity(Gravity.CENTER);shield.addView(help);Button close=new Button(this);close.setText("Close app");close.setOnClickListener(v->finish());shield.addView(close);root.addView(shield,new FrameLayout.LayoutParams(-1,-1));
  Button menu=new Button(this);menu.setText("⋮");menu.setContentDescription("Android app options");FrameLayout.LayoutParams mp=new FrameLayout.LayoutParams((int)(36*getResources().getDisplayMetrics().density),(int)(40*getResources().getDisplayMetrics().density),Gravity.TOP|Gravity.END);root.addView(menu,mp);menu.setOnClickListener(v->showOptions());
  if(!gateEnabled()){unlocked=true;shield.setVisibility(View.GONE);web.loadUrl(HOME);}else{web.setVisibility(View.INVISIBLE);}
 }
 private static String safeRoute(String route){return "/chat".equals(route)?"/chat":"";}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);String r=safeRoute(intent.getStringExtra("route"));if(web!=null&&unlocked&&!r.isEmpty())web.evaluateJavascript("location.hash="+JSONObject.quote(r),null);else pendingRoute=r;}
 private void pushToken(){if(!getSharedPreferences("push",0).getBoolean("enabled",false)||!trusted(Uri.parse(web.getUrl())))return;try{FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{if(!isFinishing()&&trusted(Uri.parse(web.getUrl())))web.evaluateJavascript("window.dispatchEvent(new CustomEvent('dd-android-token',{detail:"+JSONObject.quote(token)+"}))",null);});}catch(IllegalStateException ignored){}}
 private void enablePush(){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},84);return;}try{FirebaseMessaging.getInstance().setAutoInitEnabled(true);getSharedPreferences("push",0).edit().putBoolean("enabled",true).apply();pushToken();Toast.makeText(this,"Notifications enabled. Sign in to connect this device.",Toast.LENGTH_LONG).show();}catch(IllegalStateException e){Toast.makeText(this,"Push configuration is not included in this build.",Toast.LENGTH_LONG).show();}}
 private void finishMedia(){PermissionRequest r=mediaRequest;mediaRequest=null;if(r==null)return;ArrayList<String> allowed=new ArrayList<>();for(String x:r.getResources()){if(x.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)allowed.add(x);if(x.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)&&checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)allowed.add(x);}if(allowed.isEmpty())r.deny();else r.grant(allowed.toArray(new String[0]));}
 @Override public void onRequestPermissionsResult(int request,String[] p,int[] results){super.onRequestPermissionsResult(request,p,results);if(request==82){externalFlow=false;finishMedia();}if(request==84&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)enablePush();}
 @Override protected void onActivityResult(int r,int code,Intent data){super.onActivityResult(r,code,data);if(r==83){authenticating=false;if(code==RESULT_OK)openGate();return;}if(r==81){externalFlow=false;if(fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(code,data));fileCallback=null;}}}
 private void authenticate(){if(authenticating)return;KeyguardManager k=(KeyguardManager)getSystemService(KEYGUARD_SERVICE);if(!k.isDeviceSecure()){Toast.makeText(this,"Set a phone screen lock first.",Toast.LENGTH_LONG).show();return;}authenticating=true;
  if(Build.VERSION.SDK_INT>=30){biometricCancel=new CancellationSignal();new BiometricPrompt.Builder(this).setTitle("Unlock Dear Diary").setSubtitle("Fingerprint or phone screen lock").setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_STRONG|android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL).build().authenticate(biometricCancel,getMainExecutor(),new BiometricPrompt.AuthenticationCallback(){@Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result){authenticating=false;openGate();}@Override public void onAuthenticationError(int error,CharSequence text){authenticating=false;Toast.makeText(MainActivity.this,text,Toast.LENGTH_SHORT).show();}});
  }else{Intent i=k.createConfirmDeviceCredentialIntent("Unlock Dear Diary","Use your phone screen lock");if(i!=null)startActivityForResult(i,83);else authenticating=false;}
 }
 private void openGate(){unlocked=true;shield.setVisibility(View.GONE);web.setVisibility(View.VISIBLE);web.onResume();if(web.getUrl()==null)web.loadUrl(HOME);else if(!pendingRoute.isEmpty()){web.evaluateJavascript("location.hash="+JSONObject.quote(pendingRoute),null);pendingRoute="";}}
 @Override protected void onResume(){super.onResume();foreground=true;if(web==null)return;if(gateEnabled()&&!unlocked&&!authenticating&&!externalFlow){shield.setVisibility(View.VISIBLE);web.setVisibility(View.INVISIBLE);}else if(unlocked)web.onResume();}
 @Override protected void onPause(){super.onPause();foreground=false;if(web!=null){web.evaluateJavascript("window.dispatchEvent(new Event('dd-page-lock'));document.querySelectorAll('audio,video').forEach(a=>a.pause())",null);web.onPause();}if(gateEnabled()&&!authenticating&&!externalFlow){unlocked=false;shield.setVisibility(View.VISIBLE);web.setVisibility(View.INVISIBLE);}}
 private void showOptions(){if(gateEnabled()&&!unlocked)return;new AlertDialog.Builder(this).setTitle("Dear Diary · Android").setItems(new String[]{gateEnabled()?"Turn off device gate":"Enable device gate","Reload","About this private APK",getSharedPreferences("push",0).getBoolean("enabled",false)?"Turn off Android notifications":"Enable Android notifications"},(d,n)->{if(n==0){if(gateEnabled()){getPreferences(0).edit().putBoolean("biometric",false).apply();}else{KeyguardManager k=(KeyguardManager)getSystemService(KEYGUARD_SERVICE);if(!k.isDeviceSecure()){Toast.makeText(this,"Set a phone screen lock first.",Toast.LENGTH_LONG).show();return;}getPreferences(0).edit().putBoolean("biometric",true).apply();unlocked=false;shield.setVisibility(View.VISIBLE);web.setVisibility(View.INVISIBLE);authenticate();}}if(n==3){if(getSharedPreferences("push",0).getBoolean("enabled",false)){getSharedPreferences("push",0).edit().putBoolean("enabled",false).apply();try{FirebaseMessaging.getInstance().deleteToken();}catch(Exception ignored){}((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).cancelAll();}else enablePush();}if(n==1)web.reload();if(n==2)new AlertDialog.Builder(this).setTitle("Private Android wrapper").setMessage("Screenshot protection is on. No Play Store upload.\n\nThe diary PIN remains separate. Device gate uses Android biometrics or phone screen lock on Android 11+. Android 9–10 uses phone screen lock.\n\nAndroid notifications must be enabled in this menu and Android settings. Browser fingerprint passkeys are not migrated; use diary PIN inside. Web updates load online. File picker, microphone, GIFs and media depend on Android System WebView support.\n\nScreenshot protection cannot stop external cameras or compromised devices.").setPositiveButton("OK",null).show();}).show();}
 @Override public void onBackPressed(){if(gateEnabled()&&!unlocked){finish();return;}if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(biometricCancel!=null)biometricCancel.cancel();if(fileCallback!=null)fileCallback.onReceiveValue(null);if(mediaRequest!=null)mediaRequest.deny();if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}
