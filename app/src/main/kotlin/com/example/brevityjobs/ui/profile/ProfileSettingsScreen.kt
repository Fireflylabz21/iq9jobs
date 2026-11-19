package com.example.brevityjobs.ui.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.brevityjobs.R
import com.example.brevityjobs.domain.model.JobPost

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileSettingsScreen(
    userId: String,
    onAboutUs: () -> Unit,
    onLogout: () -> Unit,
    viewModel: ProfileSettingsViewModel = hiltViewModel()
) {
    val appliedJobs by viewModel.appliedJobs.collectAsStateWithLifecycle()
    val savedJobs by viewModel.savedJobs.collectAsStateWithLifecycle()
    val settingsState by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedJobList by remember { mutableStateOf<SettingsJobList?>(null) }
    var showProfileEditor by remember { mutableStateOf(false) }
    var showPasswordEditor by remember { mutableStateOf(false) }

    LaunchedEffect(userId) {
        viewModel.setUserId(userId)
    }
    LaunchedEffect(settingsState.message) {
        when (settingsState.message) {
            "Profile updated" -> showProfileEditor = false
            "Password updated" -> showPasswordEditor = false
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xFF020617) // Obsidian Background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                // Header HUD Style Title matching iq9 Settings screenshot
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.app_icon),
                        contentDescription = "iq9 Logo",
                        modifier = Modifier.size(32.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Settings",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 28.sp
                        )
                    )
                }

                Text(
                    text = "Configure your account and preferences",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF94A3B8)
                )
                settingsState.errorMessage?.let { message ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(message, color = MaterialTheme.colorScheme.error)
                }
                settingsState.message?.let { message ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(message, color = Color(0xFF34D399))
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Grid of setting tiles
                val settingsTiles = listOf(
                    SettingsTileItem("Applied Jobs", Icons.Default.CheckCircle, Color(0xFF38BDF8)) {
                        selectedJobList = SettingsJobList.Applied
                    },
                    SettingsTileItem("Saved for Later", Icons.Default.Star, Color(0xFFF59E0B)) {
                        selectedJobList = SettingsJobList.Saved
                    },
                    SettingsTileItem("Profile Settings", Icons.Default.Person, Color(0xFF38BDF8)) {
                        showProfileEditor = true
                    },
                    SettingsTileItem("Password & Security", Icons.Default.Lock, Color(0xFF818CF8)) {
                        showPasswordEditor = true
                    },
                    SettingsTileItem("About Us", Icons.Default.Info, Color(0xFF10B981), onAboutUs)
                )

                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    items(settingsTiles.size) { index ->
                        val tile = settingsTiles[index]
                        Card(
                            modifier = Modifier
                                .height(120.dp)
                                .clickable { tile.onClick() },
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                            border = BorderStroke(1.dp, Color(0xFF1E293B))
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Surface(
                                    modifier = Modifier.size(40.dp),
                                    shape = CircleShape,
                                    color = tile.iconColor.copy(alpha = 0.15f)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = tile.icon,
                                            contentDescription = null,
                                            tint = tile.iconColor,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(12.dp))

                                Text(
                                    text = tile.title,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color.White,
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }
                }
            }

            // Red Outlined Sign Out Button at bottom
            OutlinedButton(
                onClick = { viewModel.signOut(onLogout) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.6f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444))
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        Icons.Default.ExitToApp,
                        contentDescription = "Sign Out",
                        tint = Color(0xFFEF4444)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Sign Out",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFEF4444)
                    )
                }
            }
        }
    }

    if (showProfileEditor) {
        EditSeekerProfileDialog(
            profile = settingsState.profile,
            isLoading = settingsState.isLoading,
            onDismiss = { showProfileEditor = false },
            onSave = { title, skills, location, salary ->
                viewModel.updateTargetTitle(title)
                viewModel.updateTopSkills(skills)
                viewModel.updateExpectedLocation(location)
                viewModel.updateSalaryFloor(salary.toIntOrNull() ?: 0)
                viewModel.saveProfile()
            }
        )
    }

    if (showPasswordEditor) {
        ChangePasswordDialog(
            isLoading = settingsState.isLoading,
            errorMessage = settingsState.errorMessage,
            onDismiss = { showPasswordEditor = false },
            onChangePassword = viewModel::changePassword,
            onPasswordReset = viewModel::sendPasswordReset
        )
    }

    selectedJobList?.let { listType ->
        val jobs = when (listType) {
            SettingsJobList.Applied -> appliedJobs
            SettingsJobList.Saved -> savedJobs
        }
        AlertDialog(
            onDismissRequest = { selectedJobList = null },
            containerColor = Color(0xFF0F172A),
            titleContentColor = Color.White,
            textContentColor = Color(0xFFCBD5E1),
            title = {
                Text(
                    if (listType == SettingsJobList.Applied) "Applied Jobs" else "Saved for Later",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                if (jobs.isEmpty()) {
                    Text(
                        if (listType == SettingsJobList.Applied) {
                            "No applied jobs yet."
                        } else {
                            "No saved jobs yet."
                        }
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 420.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(jobs, key = JobPost::id) { job ->
                            JobListItem(job)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { selectedJobList = null }) {
                    Text("Close", color = Color(0xFF38BDF8))
                }
            }
        )
    }
}

@Composable
private fun EditSeekerProfileDialog(
    profile: com.example.brevityjobs.domain.model.SeekerProfile,
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onSave: (title: String, skills: String, location: String, salary: String) -> Unit
) {
    var title by remember(profile.userId, profile.targetTitle) { mutableStateOf(profile.targetTitle) }
    var skills by remember(profile.userId, profile.topSkills) { mutableStateOf(profile.topSkills.joinToString(", ")) }
    var location by remember(profile.userId, profile.expectedLocation) { mutableStateOf(profile.expectedLocation) }
    var salary by remember(profile.userId, profile.salaryFloor) {
        mutableStateOf(profile.salaryFloor.takeIf { it > 0 }?.toString().orEmpty())
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF0F172A),
        titleContentColor = Color.White,
        title = { Text("Edit Profile") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                SettingsInput("Target role", title, { title = it })
                SettingsInput("Skills (comma separated)", skills, { skills = it })
                SettingsInput("Preferred location", location, { location = it })
                SettingsInput("Minimum salary", salary, { salary = it })
            }
        },
        confirmButton = {
            TextButton(
                enabled = !isLoading,
                onClick = { onSave(title, skills, location, salary) }
            ) {
                if (isLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp))
                else Text("Save", color = Color(0xFF38BDF8))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isLoading) {
                Text("Cancel", color = Color(0xFFCBD5E1))
            }
        }
    )
}

@Composable
private fun ChangePasswordDialog(
    isLoading: Boolean,
    errorMessage: String?,
    onDismiss: () -> Unit,
    onChangePassword: (String, String) -> Unit,
    onPasswordReset: () -> Unit
) {
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF0F172A),
        titleContentColor = Color.White,
        title = { Text("Password & Security") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                SettingsInput("Current password", currentPassword, { currentPassword = it }, password = true)
                SettingsInput("New password (at least 6 characters)", newPassword, { newPassword = it }, password = true)
                errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                TextButton(onClick = onPasswordReset, enabled = !isLoading) {
                    Text("Send password reset email", color = Color(0xFF38BDF8))
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !isLoading,
                onClick = { onChangePassword(currentPassword, newPassword) }
            ) {
                if (isLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp))
                else Text("Update password", color = Color(0xFF38BDF8))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isLoading) {
                Text("Close", color = Color(0xFFCBD5E1))
            }
        }
    )
}

@Composable
private fun SettingsInput(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    password: Boolean = false
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None
    )
}

data class SettingsTileItem(
    val title: String,
    val icon: ImageVector,
    val iconColor: Color,
    val onClick: () -> Unit = {}
)

private enum class SettingsJobList {
    Applied,
    Saved
}

@Composable
private fun JobListItem(job: JobPost) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF17243A)),
        border = BorderStroke(1.dp, Color(0xFF29364D))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = job.title,
                style = MaterialTheme.typography.titleSmall,
                color = Color.White,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = job.companyName,
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFFB8ADFF)
            )
            job.location?.takeIf { it.isNotBlank() }?.let { location ->
                Text(
                    text = location,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF94A3B8)
                )
            }
        }
    }
}
