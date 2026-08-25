package com.bncphysics.classes;

import android.os.Build;

import java.io.File;

/**
 * Cheap, heuristic root detection.
 *
 * Deliberately conservative: every signal here is a strong one. Looser checks
 * (reading /proc, scanning installed packages, probing mount flags) produce
 * false positives on custom ROMs and on some perfectly ordinary Chinese
 * handsets, and a false positive locks out a student who has paid.
 *
 * None of this stops a determined person. It raises the effort, which is the
 * whole claim being made.
 */
final class RootCheck {

    private RootCheck() {}

    private static final String[] SU_PATHS = {
            "/system/bin/su",
            "/system/xbin/su",
            "/sbin/su",
            "/system/su",
            "/vendor/bin/su",
            "/su/bin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
    };

    static boolean looksRooted() {
        return hasTestKeys() || hasSuBinary() || hasMagisk();
    }

    /** A production handset is signed with release keys. */
    private static boolean hasTestKeys() {
        String tags = Build.TAGS;
        return tags != null && tags.contains("test-keys");
    }

    private static boolean hasSuBinary() {
        for (String p : SU_PATHS) {
            try {
                if (new File(p).exists()) return true;
            } catch (SecurityException ignored) {
                // Sandbox refused the stat. Absence of evidence, not evidence.
            }
        }
        return false;
    }

    private static boolean hasMagisk() {
        try {
            return new File("/sbin/.magisk").exists()
                    || new File("/data/adb/magisk").exists();
        } catch (SecurityException ignored) {
            return false;
        }
    }
}
