package com.deardiary.privateapp;
import java.net.URI;
/** No redirects, credentials, custom ports or arbitrary Instagram paths accepted. */
final class InstagramReelUrl{
 static String clean(String value){try{URI u=new URI(value);String h=u.getHost();if(!"https".equals(u.getScheme())||u.getRawUserInfo()!=null||u.getPort()!=-1||!("instagram.com".equals(h)||"www.instagram.com".equals(h)||"m.instagram.com".equals(h)))return null;String p=u.getRawPath();if(p==null||!p.matches("/reel/[A-Za-z0-9_-]{1,100}/?"))return null;return "https://www.instagram.com"+p+(p.endsWith("/")?"":"/");}catch(Exception e){return null;}}
}
