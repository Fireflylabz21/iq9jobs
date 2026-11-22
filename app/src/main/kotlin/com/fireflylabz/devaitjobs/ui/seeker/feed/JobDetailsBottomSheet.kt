package com.fireflylabz.devaitjobs.ui.seeker.feed

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.fireflylabz.devaitjobs.domain.model.JobPost
import com.fireflylabz.devaitjobs.domain.model.WorkMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JobDetailsBottomSheet(
    job: JobPost,
    onDismiss: () -> Unit,
    onApplyClick: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF0F172A),
        contentColor = Color(0xFFF8FAFC)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.85f)
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = job.companyName,
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFF94A3B8)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = job.title,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFF8FAFC)
                    )
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                }
            }

            HorizontalDivider(color = Color(0xFF334155))

            Text(
                text = "JOB DETAILS",
                style = MaterialTheme.typography.labelMedium,
                color = Color(0xFFAFA6FF),
                fontWeight = FontWeight.Bold
            )
            DetailRow(label = "Job ID", value = job.id)
            DetailRow(
                label = "Location",
                value = job.location?.takeIf { it.isNotBlank() } ?: "Not specified"
            )
            DetailRow(
                label = "Work style",
                value = if (job.workMode == WorkMode.UNSPECIFIED) "Not specified" else job.workMode.name
            )
            when {
                job.minExperience != null && job.maxExperience != null ->
                    DetailRow(
                        label = "Experience",
                        value = "${job.minExperience}-${job.maxExperience} years"
                    )
                job.minExperience != null ->
                    DetailRow(label = "Experience", value = "${job.minExperience}+ years")
                job.maxExperience != null ->
                    DetailRow(label = "Experience", value = "Up to ${job.maxExperience} years")
                else ->
                    DetailRow(label = "Experience", value = "Not specified")
            }
            if (job.salaryMin > 0 && job.salaryMax > 0) {
                DetailRow(
                    label = "Salary",
                    value = "\$${job.salaryMin / 1000}k-\$${job.salaryMax / 1000}k"
                )
            }
            DetailRow(label = "Posted", value = job.postedAt ?: "Not specified")
            DetailRow(label = "Status", value = "Active")

            Text(
                text = "JOB SUMMARY",
                style = MaterialTheme.typography.labelMedium,
                color = Color(0xFFAFA6FF),
                fontWeight = FontWeight.Bold
            )
            Text(
                text = job.teamObjective.ifBlank { "No job summary provided." },
                style = MaterialTheme.typography.bodyLarge,
                color = Color(0xFFCBD5E1)
            )

            Text(
                text = "REQUIRED SKILLS",
                style = MaterialTheme.typography.labelMedium,
                color = Color(0xFFAFA6FF),
                fontWeight = FontWeight.Bold
            )
            if (job.coreSkills.isEmpty()) {
                Text("No required skills listed.", color = Color(0xFFCBD5E1))
            } else {
                job.coreSkills.forEach { skill ->
                    Text(
                        text = "• $skill",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFFCBD5E1)
                    )
                }
            }

            Text(
                text = "Apply link",
                style = MaterialTheme.typography.labelMedium,
                color = Color(0xFFAFA6FF),
                fontWeight = FontWeight.Bold
            )
            Text(
                text = job.applyUrl?.takeIf { it.isNotBlank() } ?: "No application link available",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFCBD5E1),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Button(
                onClick = onApplyClick,
                enabled = !job.applyUrl.isNullOrBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED))
            ) {
                Text("Open application link", fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }

}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            label,
            modifier = Modifier.weight(0.35f),
            color = Color(0xFF94A3B8),
            style = MaterialTheme.typography.bodyMedium
        )
        Text(
            value,
            modifier = Modifier.weight(0.65f),
            color = Color(0xFFE2E8F0),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            textAlign = androidx.compose.ui.text.style.TextAlign.End
        )
    }
}

