# The JavaScript bridge is reached by name from the web page, so R8 must not
# rename or strip it.
-keepclassmembers class com.bncphysics.classes.MainActivity$Bridge {
   public *;
}
-keepattributes JavascriptInterface
