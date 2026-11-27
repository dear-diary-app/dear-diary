package com.deardiary.privateapp;
/** Fixed event descriptions only. Never formats names or private payload content. */
final class NotificationCopy{
 static String body(String type){if(type==null)return "Open Dear Diary to check your notifications.";switch(type){
 case "friend_free":return "Your friend is free now.";
 case "ask":return "11 PM /ask reminder: if you have not used today's question, ask before midnight IST.";
 case "writing":return "9 PM writing reminder: write today's diary before it locks at 10 PM IST.";
 case "lock":return "15 minutes left to write. Your diary locks at 10 PM IST.";
 case "open":return "A new diary page is ready. Writing is open until 10 PM IST.";
 case "published":return "It is 10 PM IST. Writing is closed and nightly reading time has begun.";
 case "chat":return "You have a new chat message. Open Dear Diary to read it.";
 case "scheduled_sent":return "Your scheduled message was sent.";
 case "feed":return "There is new activity on a feed post.";
 default:return "Open Dear Diary to check your notifications.";}}
 static boolean chat(String type){return "chat".equals(type)||"friend_free".equals(type)||"scheduled_sent".equals(type)||"ask".equals(type);}
 static int id(String type){return 1700+java.util.Arrays.asList("chat","friend_free","scheduled_sent","feed","open","writing","lock","published","ask").indexOf(type);}
}
