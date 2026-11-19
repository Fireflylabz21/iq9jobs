package com.example.brevityjobs.ui.seeker.feed

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.example.brevityjobs.domain.model.JobPost
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@Composable
fun SwipeableRoleCardDeck(
    jobs: List<JobPost>,
    onToggleSaved: (JobPost, Boolean) -> Unit = { _, _ -> },
    onJobSkipped: (JobPost) -> Unit = {},
    onApplicationStarted: (JobPost) -> Unit = {},
    onOpenApplication: (JobPost) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var currentJobId by remember { mutableStateOf<String?>(null) }
    var showDetails by remember { mutableStateOf(false) }
    val dismissedJobIds = remember { mutableStateListOf<String>() }
    val visibleJobs = jobs.filterNot { it.id in dismissedJobIds }
    val selectedIndex = currentJobId?.let { id ->
        visibleJobs.indexOfFirst { it.id == id }.takeIf { it >= 0 }
    } ?: 0

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF080D19))
            .padding(horizontal = 20.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        if (selectedIndex >= visibleJobs.size) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Surface(
                    shape = CircleShape,
                    color = Color(0xFF17243A),
                    modifier = Modifier.size(72.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        androidx.compose.material3.Icon(
                            Icons.Default.Star,
                            contentDescription = null,
                            tint = Color(0xFF8B7CFF),
                            modifier = Modifier.size(34.dp)
                        )
                    }
                }
                Text(
                    text = if (jobs.isEmpty()) "No roles match your profile yet" else "You're all caught up",
                    style = MaterialTheme.typography.headlineSmall,
                    color = Color(0xFFF3F5FC),
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (jobs.isEmpty()) {
                        "New opportunities will appear here when available."
                    } else {
                        "Check back soon for more opportunities."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF97A3B8)
                )
            }
        } else {
            val job = visibleJobs[selectedIndex]
            fun advanceDeck() {
                dismissedJobIds.add(job.id)
                currentJobId = visibleJobs.getOrNull(selectedIndex + 1)?.id
                showDetails = false
            }
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                RoleCard(
                    job = job,
                    onToggleSaved = { onToggleSaved(job, !job.isSaved) },
                    onShare = { shareJob(context, job) },
                    onSkip = {
                        onJobSkipped(job)
                        advanceDeck()
                    },
                    onApply = {
                        openApplication(context, job, onApplicationStarted, onOpenApplication)
                            .also { if (it) advanceDeck() }
                    },
                    onShowDetails = { showDetails = true },
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                )

                Text(
                    text = "Swipe left to skip  ·  Swipe right to apply  ·  Double tap for details",
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF8B96AA),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )

                if (showDetails) {
                    JobDetailsBottomSheet(
                        job = job,
                        onDismiss = { showDetails = false },
                        onApplyClick = {
                            if (openApplication(context, job, onApplicationStarted, onOpenApplication)) {
                                advanceDeck()
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
@OptIn(ExperimentalFoundationApi::class)
private fun RoleCard(
    job: JobPost,
    onToggleSaved: () -> Unit,
    onShare: () -> Unit,
    onSkip: () -> Unit,
    onApply: () -> Boolean,
    onShowDetails: () -> Unit,
    modifier: Modifier = Modifier
) {
    val offsetX = remember(job.id) { Animatable(0f) }
    val scope = rememberCoroutineScope()
    var isAnimating by remember(job.id) { mutableStateOf(false) }
    val rotation = (offsetX.value / 45f).coerceIn(-12f, 12f)
    val experience = when {
        job.minExperience != null && job.maxExperience != null ->
            "${job.minExperience}-${job.maxExperience} years experience"
        job.minExperience != null -> "${job.minExperience}+ years experience"
        job.maxExperience != null -> "Up to ${job.maxExperience} years experience"
        else -> null
    }

    suspend fun swipe(left: Boolean) {
        if (isAnimating) return
        isAnimating = true
        offsetX.animateTo(
            targetValue = if (left) -1600f else 1600f,
            animationSpec = spring(stiffness = 180f)
        )
        if (left) {
            onSkip()
        } else if (!onApply()) {
            offsetX.animateTo(0f, spring())
        }
        isAnimating = false
    }

    Card(
        modifier = modifier
            .offset { IntOffset(offsetX.value.roundToInt(), 0) }
            .rotate(rotation)
            .combinedClickable(
                onClick = {},
                onDoubleClick = onShowDetails
            )
            .pointerInput(job.id) {
                detectDragGestures(
                    onDragEnd = {
                        scope.launch {
                            when {
                                offsetX.value < -140f -> swipe(left = true)
                                offsetX.value > 140f -> swipe(left = false)
                                else -> offsetX.animateTo(0f, spring())
                            }
                        }
                    },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        scope.launch {
                            if (!isAnimating) {
                                offsetX.snapTo(offsetX.value + dragAmount.x)
                            }
                        }
                    }
                )
            },
        shape = RoundedCornerShape(28.dp),
        border = BorderStroke(1.dp, Color(0xFF2C3650)),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF111A2B)),
        elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFF18243A), Color(0xFF0F1727))
                    )
                )
                .padding(24.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = Color(0xFF28264C),
                            modifier = Modifier.size(48.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = job.companyName.take(1).uppercase(),
                                    style = MaterialTheme.typography.titleLarge,
                                    color = Color(0xFFB8ADFF),
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = job.companyName,
                                style = MaterialTheme.typography.titleMedium,
                                color = Color(0xFFE5E9F4),
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.LocationOn,
                                    contentDescription = null,
                                    tint = Color(0xFF9DAAC0),
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = job.location?.takeIf(String::isNotBlank)
                                        ?: "Location not specified",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF9DAAC0),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                    Row {
                        IconButton(onClick = onShare) {
                            Icon(
                                Icons.Default.Share,
                                contentDescription = "Share job",
                                tint = Color(0xFFC6D2E5)
                            )
                        }
                        IconButton(onClick = onToggleSaved) {
                            Icon(
                                imageVector = if (job.isSaved) {
                                    Icons.Default.Star
                                } else {
                                    Icons.Default.Star
                                },
                                contentDescription = if (job.isSaved) "Remove saved job" else "Save job",
                                tint = if (job.isSaved) Color(0xFFAFA6FF) else Color(0xFFC6D2E5)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = job.title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = Color(0xFFF5F6FC),
                    fontWeight = FontWeight.Bold,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )

                experience?.let {
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = Color(0xFF202C43),
                        border = BorderStroke(1.dp, Color(0xFF34445F))
                    ) {
                        Text(
                            text = it,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                            style = MaterialTheme.typography.labelMedium,
                            color = Color(0xFFC6D2E5),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Column(
                modifier = Modifier.weight(1f, fill = false),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "ROLE SUMMARY",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF9BA7BD),
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = job.teamObjective.ifBlank { "No job summary provided." },
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color(0xFFD8DFED),
                    maxLines = 8,
                    overflow = TextOverflow.Ellipsis
                )

                if (job.coreSkills.isNotEmpty()) {
                    Text(
                        text = job.coreSkills.take(5).joinToString("  ·  "),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFAFA6FF),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { scope.launch { swipe(left = true) } },
                    modifier = Modifier.weight(1f),
                    enabled = !isAnimating,
                    border = BorderStroke(1.dp, Color(0xFF46536A)),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color(0xFFD5DCEC)
                    )
                ) {
                    Text("Skip")
                }
                Button(
                    onClick = { scope.launch { swipe(left = false) } },
                    modifier = Modifier.weight(1.3f),
                    enabled = !isAnimating && !job.applyUrl.isNullOrBlank(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF7567F8),
                        disabledContainerColor = Color(0xFF3B3D55)
                    )
                ) {
                    Text("Apply", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private fun openApplication(
    context: android.content.Context,
    job: JobPost,
    onApplicationStarted: (JobPost) -> Unit,
    onOpenApplication: (JobPost) -> Unit
): Boolean {
    val uri = job.applyUrl?.let(Uri::parse)
    if (uri == null || uri.scheme !in setOf("https", "http") || uri.host.isNullOrBlank()) {
        Toast.makeText(context, "Application link is unavailable.", Toast.LENGTH_SHORT).show()
        return false
    }

    onApplicationStarted(job)
    onOpenApplication(job)
    return true
}

private fun shareJob(context: android.content.Context, job: JobPost) {
    val experience = when {
        job.minExperience != null && job.maxExperience != null ->
            "${job.minExperience}-${job.maxExperience} years"
        job.minExperience != null -> "${job.minExperience}+ years"
        job.maxExperience != null -> "Up to ${job.maxExperience} years"
        else -> null
    }
    val shareText = buildString {
        appendLine("${job.title} at ${job.companyName}")
        job.location?.takeIf { it.isNotBlank() }?.let { appendLine("Location: $it") }
        experience?.let { appendLine("Experience: $it") }
        appendLine()
        appendLine(job.teamObjective.ifBlank { "Job opportunity" })
        job.applyUrl?.takeIf { it.isNotBlank() }?.let {
            appendLine()
            appendLine("Apply: $it")
        }
    }

    val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, "${job.title} at ${job.companyName}")
        putExtra(Intent.EXTRA_TEXT, shareText)
    }

    try {
        context.startActivity(Intent.createChooser(sendIntent, "Share job"))
    } catch (error: ActivityNotFoundException) {
        Toast.makeText(context, "No app is available to share this job.", Toast.LENGTH_LONG).show()
    }
}
