# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Capacitor looks plugins up by @CapacitorPlugin(name=...) and invokes
# @PluginMethod methods reflectively from JavaScript.
-keepattributes *Annotation*, InnerClasses, Signature, Exceptions, EnclosingMethod
-keep @interface com.getcapacitor.annotation.CapacitorPlugin
-keep @interface com.getcapacitor.PluginMethod
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclasseswithmembernames class * {
    @com.getcapacitor.PluginMethod <methods>;
}
-keep class com.getcapacitor.** { *; }
-keep class com.autoet.expensetracker.** { *; }

# Room builds DAO / database implementations at compile time; entities and
# DAOs must survive shrinking for those generated classes to work.
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class androidx.room.** { *; }
-keep @interface androidx.room.Dao
-keep class * {
    @androidx.room.Dao *;
}

# SQLCipher's native library and SupportOpenHelperFactory are used reflectively.
-keep class net.zetetic.database.sqlcipher.** { *; }
-keep class androidx.sqlite.db.** { *; }
-dontwarn net.zetetic.**
-dontwarn android.support.**

# Keep source file names in stack traces for device debugging.
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile
