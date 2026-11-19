package com.iq9.assessment.design.sample

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// IQ9 Design System Color Tokens
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

val IQ9DarkColorScheme = darkColorScheme(
    primary = IQ9Colors.Primary,
    background = IQ9Colors.Background,
    surface = IQ9Colors.Surface,
    onPrimary = IQ9Colors.TextPrimary,
    onBackground = IQ9Colors.TextPrimary,
    onSurface = IQ9Colors.TextPrimary,
    surfaceVariant = IQ9Colors.SurfaceVariant
)

@Composable
fun IQ9Theme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = IQ9DarkColorScheme,
        content = content
    )
}
