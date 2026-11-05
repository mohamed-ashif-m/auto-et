
package com.autoet.expensetracker;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.security.KeyStore;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class DatabaseKeyManager {

    private static final String KEY_ALIAS = "AutoEtDatabaseKey";
    private static final String PREFS = "auto_et_secure_db";
    private static final String CIPHER_TEXT = "encrypted_passphrase";
    private static final String IV_TEXT = "passphrase_iv";

    public static byte[] getOrCreatePassphrase(Context context)
            throws Exception {

        SharedPreferences prefs = context.getSharedPreferences(
                PREFS, Context.MODE_PRIVATE
        );

        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);

        SecretKey secretKey;

        if (keyStore.containsAlias(KEY_ALIAS)) {
            secretKey = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        } else {
            KeyGenerator generator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    "AndroidKeyStore"
            );

            generator.init(
                    new KeyGenParameterSpec.Builder(
                            KEY_ALIAS,
                            KeyProperties.PURPOSE_ENCRYPT
                                    | KeyProperties.PURPOSE_DECRYPT
                    )
                            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                            .setEncryptionPaddings(
                                    KeyProperties.ENCRYPTION_PADDING_NONE
                            )
                            .setRandomizedEncryptionRequired(true)
                            .build()
            );

            secretKey = generator.generateKey();
        }

        String savedCiphertext = prefs.getString(CIPHER_TEXT, null);
        String savedIv = prefs.getString(IV_TEXT, null);

        if (savedCiphertext != null && savedIv != null) {

            byte[] encrypted = Base64.decode(
                    savedCiphertext, Base64.NO_WRAP
            );

            byte[] iv = Base64.decode(savedIv, Base64.NO_WRAP);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");

            cipher.init(
                    Cipher.DECRYPT_MODE,
                    secretKey,
                    new GCMParameterSpec(128, iv)
            );

            return cipher.doFinal(encrypted);
        }

        // Generate a random 256-bit database passphrase.
        byte[] passphrase = new byte[32];
        new SecureRandom().nextBytes(passphrase);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey);

        byte[] encrypted = cipher.doFinal(passphrase);
        byte[] iv = cipher.getIV();

        boolean saved = prefs.edit()
                .putString(
                        CIPHER_TEXT,
                        Base64.encodeToString(encrypted, Base64.NO_WRAP)
                )
                .putString(
                        IV_TEXT,
                        Base64.encodeToString(iv, Base64.NO_WRAP)
                )
                .commit();

        if (!saved) {
            throw new IllegalStateException(
                    "Could not save the encrypted database key"
            );
        }

        return passphrase;
    }
}
