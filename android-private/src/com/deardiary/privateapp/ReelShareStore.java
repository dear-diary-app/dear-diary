package com.deardiary.privateapp;
import android.content.*;import android.security.keystore.*;import android.util.Base64;import java.security.*;import javax.crypto.*;import javax.crypto.spec.GCMParameterSpec;
/** Send-only capability, encrypted with a non-exportable Android Keystore key. */
final class ReelShareStore{
 static final String ALIAS="reel-share-send-only";
 static synchronized void save(Context c,String uid,String token)throws Exception{if(!uid.matches("[a-f0-9-]{36}")||!token.matches("[a-f0-9]{64}"))throw new SecurityException();clear(c);KeyGenerator g=KeyGenerator.getInstance("AES","AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());byte[] encrypted=cipher.doFinal(token.getBytes("UTF-8"));c.getSharedPreferences("reel-share",0).edit().putString("owner",uid).putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).putString("sealed",Base64.encodeToString(encrypted,Base64.NO_WRAP)).commit();}
 static java.security.Key key()throws Exception{KeyStore k=KeyStore.getInstance("AndroidKeyStore");k.load(null);return k.getKey(ALIAS,null);}
 static synchronized String read(Context c)throws Exception{android.content.SharedPreferences p=c.getSharedPreferences("reel-share",0);String sealed=p.getString("sealed","");if(sealed.isEmpty())throw new SecurityException();Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(p.getString("iv",""),Base64.NO_WRAP)));return new String(cipher.doFinal(Base64.decode(sealed,Base64.NO_WRAP)),"UTF-8");}
 static synchronized void clear(Context c){c.getSharedPreferences("reel-share",0).edit().clear().commit();try{KeyStore k=KeyStore.getInstance("AndroidKeyStore");k.load(null);k.deleteEntry(ALIAS);}catch(Exception ignored){}}
 static boolean enabled(Context c){return c.getSharedPreferences("reel-share",0).contains("sealed");}
}
