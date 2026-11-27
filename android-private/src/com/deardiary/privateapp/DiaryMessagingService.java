package com.deardiary.privateapp;
import android.app.*;
import android.content.*;
import android.os.Build;
import com.google.firebase.messaging.*;
import java.util.Map;

public final class DiaryMessagingService extends FirebaseMessagingService {
 @Override public void onMessageReceived(RemoteMessage message){
  Map<String,String> d=message.getData();android.content.SharedPreferences p=getSharedPreferences("push",0);
  if(MainActivity.foreground||p.getBoolean("friend_mode",false))return;
  if(!p.getBoolean("enabled",false)||!p.getString("uid","").equals(d.get("account_id")))return;
  NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
  String channel="diary_private";nm.createNotificationChannel(new NotificationChannel(channel,"Dear Diary",NotificationManager.IMPORTANCE_DEFAULT));
  Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("route",NotificationCopy.chat(d.get("type"))?"/chat":"");
  PendingIntent pi=PendingIntent.getActivity(this,NotificationCopy.id(d.get("type")),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification n=new Notification.Builder(this,channel).setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle("Dear Diary").setContentText(NotificationCopy.body(d.get("type"))).setContentIntent(pi).setAutoCancel(true).setVisibility(Notification.VISIBILITY_SECRET).build();
  if(Build.VERSION.SDK_INT<33||checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)==android.content.pm.PackageManager.PERMISSION_GRANTED){if(!p.getBoolean("friend_mode",false))nm.notify(NotificationCopy.id(d.get("type")),n);}
 }
 @Override public void onNewToken(String token){/* Sent to the authenticated backend on the next app open. */}
}
