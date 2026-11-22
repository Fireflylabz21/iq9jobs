/*
 * Copyright 2026 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.fireflylabz.devaitjobs.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

// IQ9 Design System Color Tokens & Scheme
object IQ9Colors {
    val Background = Color(0xFF020617)
    val Surface = Color(0xFF0F172A)
    val SurfaceVariant = Color(0xFF1E1B4B)
    val Border = Color(0xFF1E293B)
    val Primary = Color(0xFF2563EB)
    val PrimaryVariant = Color(0xFF4338CA)
    val CyanHighlight = Color(0xFF38BDF8)
    val TextPrimary = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFF94A3B8)
    val Success = Color(0xFF34D399)
    val Warning = Color(0xFFF59E0B)
}

private val IQ9DarkColorScheme = darkColorScheme(
    primary = IQ9Colors.Primary,
    onPrimary = IQ9Colors.TextPrimary,
    primaryContainer = IQ9Colors.SurfaceVariant,
    onPrimaryContainer = IQ9Colors.CyanHighlight,
    secondary = IQ9Colors.Success,
    onSecondary = IQ9Colors.Background,
    background = IQ9Colors.Background,
    onBackground = IQ9Colors.TextPrimary,
    surface = IQ9Colors.Surface,
    onSurface = IQ9Colors.TextPrimary,
    surfaceVariant = IQ9Colors.SurfaceVariant,
    onSurfaceVariant = IQ9Colors.TextSecondary,
    outline = IQ9Colors.Border
)

@Composable
fun BrevityJobsTheme(
    darkTheme: Boolean = true,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = IQ9DarkColorScheme,
        typography = Typography,
        content = content
    )
}

