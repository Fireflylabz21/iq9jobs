package com.iq9.assessment.design.sample

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun IQ9AgentBannerSample(
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = IQ9Colors.SurfaceVariant),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, IQ9Colors.PrimaryVariant)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Surface(
                    color = IQ9Colors.PrimaryVariant,
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = IQ9Colors.TextPrimary,
                        modifier = Modifier
                            .size(24.dp)
                            .padding(4.dp)
                    )
                }
                Column {
                    Text(
                        text = title,
                        color = IQ9Colors.TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = subtitle,
                        color = Color(0xFFC7D2FE),
                        fontSize = 11.sp
                    )
                }
            }
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = Color(0xFF818CF8)
            )
        }
    }
}

@Composable
fun IQ9TextFieldColorsSample() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = IQ9Colors.CyanHighlight,
    unfocusedBorderColor = IQ9Colors.Border,
    focusedContainerColor = IQ9Colors.Surface,
    unfocusedContainerColor = IQ9Colors.Surface,
    focusedTextColor = IQ9Colors.TextPrimary,
    unfocusedTextColor = IQ9Colors.TextPrimary,
    focusedLabelColor = IQ9Colors.CyanHighlight,
    unfocusedLabelColor = IQ9Colors.TextSecondary
)
