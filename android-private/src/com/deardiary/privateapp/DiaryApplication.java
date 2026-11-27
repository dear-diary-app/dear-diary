package com.deardiary.privateapp;
import android.app.Application;import android.webkit.WebView;
public final class DiaryApplication extends Application{
 @Override public void onCreate(){super.onCreate();if((getPackageName()+":instagram").equals(Application.getProcessName()))WebView.setDataDirectorySuffix("instagram-private");}
}
