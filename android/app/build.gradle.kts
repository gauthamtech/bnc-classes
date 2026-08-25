import java.util.Properties

plugins {
    id("com.android.application")
}

/**
 * Release signing. Credentials live in android/keystore.properties, which is
 * gitignored along with the .jks — committing either would let anyone who
 * clones the repo publish as BNC.
 *
 * If the file is absent the release build simply stays unsigned rather than
 * failing, so a fresh clone can still compile.
 */
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.bncphysics.classes"
    compileSdk = 36

    signingConfigs {
        create("release") {
            if (keystoreProps.getProperty("storeFile") != null) {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    defaultConfig {
        applicationId = "com.bncphysics.classes"
        minSdk = 24          // Android 7.0 — covers effectively every handset in use
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        // ---------------------------------------------------------------
        // WHERE THE APP LOADS FROM.
        //
        // BUNDLED (current). The web build ships inside the APK and is served
        // from https://appassets.androidplatform.net. The app contacts nothing
        // but Supabase's API — there is no website, no hosted page, no URL
        // anyone could be given. Client's requirement.
        //
        // Cost of this choice: a UI fix needs a new Play release. Adding
        // lessons does NOT — videos are data, fetched at runtime, so content
        // can be uploaded weekly and a two-year-old APK still sees it.
        //
        // REMOTE. Set LOAD_BUNDLED to false to load REMOTE_URL instead. Kept
        // working for debugging against a deployed build; not the shipping mode.
        //
        // Sign-in is identical either way — it returns over the bncapp://
        // scheme and never touches a web address.
        // ---------------------------------------------------------------
        buildConfigField("boolean", "LOAD_BUNDLED", "true")
        buildConfigField("String", "REMOTE_URL", "\"https://bncphysics.com/app/\"")

        // ---------------------------------------------------------------
        // FLAG_SECURE. On by default, everywhere.
        //
        // It also blocks YOUR screenshots, which makes visual QA on a device
        // impossible — every capture comes out black. For that, and only that:
        //
        //     .\gradlew.bat assembleDebug -PallowCapture=true
        //
        // A Gradle property rather than a debug/release split, so turning it
        // off is always a deliberate act on one build. The release block below
        // forces it back on regardless, so an unprotected APK cannot ship.
        // ---------------------------------------------------------------
        val allowCapture = providers.gradleProperty("allowCapture").orNull == "true"
        buildConfigField("boolean", "SECURE_SCREEN", (!allowCapture).toString())
        if (allowCapture) {
            logger.warn("⚠  FLAG_SECURE DISABLED for this build. Screen recording is NOT blocked.")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            // Never negotiable in a shipping build, whatever -PallowCapture said.
            buildConfigField("boolean", "SECURE_SCREEN", "true")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

/**
 * Copy the web build into the APK's assets on every build.
 *
 * Doing this by hand guarantees a stale app eventually ships: someone edits the
 * React code, runs `npm run build`, builds the APK, and gets yesterday's screens
 * with no error anywhere. Sync (not Copy) mirrors the folder, so files deleted
 * from dist also disappear here instead of lingering.
 */
val syncWebBuild by tasks.registering(Sync::class) {
    val dist = rootProject.file("../web/dist")
    from(dist) {
        // Rewrite rules for other hosts. Meaningless inside an APK.
        exclude("_redirects", ".htaccess", "robots.txt")
    }
    into(layout.projectDirectory.dir("src/main/assets/app"))

    doFirst {
        if (!dist.isDirectory || !File(dist, "index.html").exists()) {
            throw GradleException(
                "web/dist is missing or empty. Run `npm run build` in D:\\BNC App\\web first — " +
                "the APK bundles that output and cannot be built without it."
            )
        }
    }
}

tasks.named("preBuild") { dependsOn(syncWebBuild) }

dependencies {
    // One of the androidx libraries still drags in kotlin-stdlib-jdk7/jdk8
    // 1.6.21, whose classes were folded into kotlin-stdlib itself in 1.8 —
    // so the same class arrives twice and dexing fails. Pinning the jdk7/jdk8
    // artifacts to 1.8.22 makes them the empty forwarding stubs they became,
    // and the duplicates disappear. No Kotlin is used in this project.
    constraints {
        implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22")
        implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22")
    }

    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core:1.13.1")
    // Chrome Custom Tabs. Not optional: Google refuses OAuth inside a plain
    // WebView, so sign-in has to leave the WebView and come back.
    implementation("androidx.browser:browser:1.8.0")
    // Serves bundled assets over https://appassets.androidplatform.net so the
    // page gets a secure origin. file:// does not, and localStorage — where
    // the Supabase session lives — behaves badly without one.
    implementation("androidx.webkit:webkit:1.11.0")
}
