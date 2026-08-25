plugins {
    // AGP 9.x needs a newer Gradle than is available here and buys this project
    // nothing. 8.13.2 is the current 8.x, supports compileSdk 36, and pairs
    // with Gradle 8.14 as pinned in gradle/wrapper/gradle-wrapper.properties.
    id("com.android.application") version "8.13.2" apply false
}
