package com.deardiary.privateapp;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import java.util.LinkedHashSet;

/** Framework parseResult only reads Intent.data on some WebView versions.
 * GET_CONTENT and the system Photo Picker also return single/multiple ClipData.
 * Never read text/extras or accept local/app-private URI fallbacks. */
final class PickerResults {
 static final int MAX_FILES=64;
 static Uri[] parse(int resultCode,Intent data,String ownPackage){
  if(resultCode!=Activity.RESULT_OK||data==null)return null;
  LinkedHashSet<Uri> files=new LinkedHashSet<>();
  ClipData clip=data.getClipData();
  if(clip!=null){
   if(clip.getItemCount()>MAX_FILES)return null;
   for(int i=0;i<clip.getItemCount();i++)add(files,clip.getItemAt(i).getUri(),ownPackage);
  }
  add(files,data.getData(),ownPackage);
  return files.isEmpty()?null:files.toArray(new Uri[0]);
 }
 private static void add(LinkedHashSet<Uri> files,Uri uri,String ownPackage){
  if(uri==null||!"content".equalsIgnoreCase(uri.getScheme()))return;
  String authority=uri.getAuthority();
  if(authority==null||authority.isEmpty())return;
  // Multi-user authorities may be prefixed by the numeric Android user ID.
  int at=authority.lastIndexOf('@');if(at>=0)authority=authority.substring(at+1);
  if(authority.equalsIgnoreCase(ownPackage)||authority.toLowerCase(java.util.Locale.ROOT).startsWith(ownPackage.toLowerCase(java.util.Locale.ROOT)+"."))return;
  files.add(uri);
 }
 private PickerResults(){}
}
