package com.deardiary.privateapp;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,manifest=Config.NONE)
public class PickerResultsTest {
 private static final String APP="com.deardiary.privateapp";
 private static final Uri A=Uri.parse("content://media/picker/photo/1"),B=Uri.parse("content://com.android.providers.media.documents/document/image%3A2");
 private Uri[] parse(Intent i){return PickerResults.parse(Activity.RESULT_OK,i,APP);}
 private Intent clip(Uri...uris){ClipData c=ClipData.newRawUri("Synthetic photo",uris[0]);for(int j=1;j<uris.length;j++)c.addItem(new ClipData.Item(uris[j]));Intent i=new Intent();i.setClipData(c);return i;}
 @Test public void oldSingleData(){assertArrayEquals(new Uri[]{A},parse(new Intent().setData(A)));}
 @Test public void singleClipOnly(){assertArrayEquals(new Uri[]{A},parse(clip(A)));}
 @Test public void multipleClipOnly(){assertArrayEquals(new Uri[]{A,B},parse(clip(A,B)));}
 @Test public void duplicateDataAndClip(){assertArrayEquals(new Uri[]{A,B},parse(clip(A,B).setData(A)));}
 @Test public void fallbackAfterTextClip(){Intent i=new Intent().setData(A);i.setClipData(ClipData.newPlainText("text","not a photo"));assertArrayEquals(new Uri[]{A},parse(i));}
 @Test public void cancelledIgnoresAll(){assertNull(PickerResults.parse(Activity.RESULT_CANCELED,clip(A),APP));}
 @Test public void nullAndEmpty(){assertNull(parse(null));assertNull(parse(new Intent()));}
 @Test public void untrustedSchemes(){for(String u:new String[]{"file:///data/user/0/secret","https://example.invalid/photo","data:image/jpeg;base64,xxx","content:///no-authority"})assertNull(parse(new Intent().setData(Uri.parse(u))));}
 @Test public void ownProviderDenied(){for(String u:new String[]{"content://com.deardiary.privateapp.updates/a","content://com.deardiary.privateapp/a","content://10@com.deardiary.privateapp.updates/a"})assertNull(parse(new Intent().setData(Uri.parse(u))));}
 @Test public void mixedSkipsUnsafe(){assertArrayEquals(new Uri[]{A},parse(clip(Uri.parse("file:///private"),A)));}
 @Test public void tooManyRejected(){Uri[] a=new Uri[65];for(int i=0;i<a.length;i++)a[i]=Uri.parse("content://media/"+i);assertNull(parse(clip(a)));}
}
