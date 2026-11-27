package com.deardiary.privateapp;
import org.junit.Test;import static org.junit.Assert.*;
public class InstagramReelUrlTest{
 @Test public void canonicalizesAndDropsTracking(){assertEquals("https://www.instagram.com/reel/ABC_-123/",InstagramReelUrl.clean("https://m.instagram.com/reel/ABC_-123?igsh=tracking#frag"));}
 @Test public void rejectsUnexpectedTargets(){for(String s:new String[]{null,"http://www.instagram.com/reel/ABC/","https://www.instagram.com.evil.test/reel/ABC/","https://evil.test@instagram.com/reel/ABC/","https://instagram.com:444/reel/ABC/","https://instagram.com/p/ABC/","https://instagram.com/reels/","https://instagram.com/reel/ABC/extra","https://instagram.com/reel/%41/","javascript:alert(1)","https://instagram.com/reel/a%2Fb/"})assertNull(s,InstagramReelUrl.clean(s));}
}
