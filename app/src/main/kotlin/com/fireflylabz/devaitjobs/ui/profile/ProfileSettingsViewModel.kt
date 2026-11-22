package com.fireflylabz.devaitjobs.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.util.Log
import com.fireflylabz.devaitjobs.domain.model.JobPost
import com.fireflylabz.devaitjobs.domain.model.NoticePeriod
import com.fireflylabz.devaitjobs.domain.repository.JobRepository
import com.fireflylabz.devaitjobs.domain.model.SeekerProfile
import com.fireflylabz.devaitjobs.domain.repository.ProfileRepository
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.EmailAuthProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.CancellationException
import javax.inject.Inject
import kotlinx.coroutines.ExperimentalCoroutinesApi

data class ProfileSettingsUiState(
    val profile: SeekerProfile = SeekerProfile(
        userId = "",
        targetTitle = "",
        salaryFloor = 0,
        noticePeriod = NoticePeriod.IMMEDIATE,
        topSkills = emptyList(),
        highlights = emptyList()
    ),
    val isSaved: Boolean = false,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val message: String? = null
)

@HiltViewModel
@OptIn(ExperimentalCoroutinesApi::class)
class ProfileSettingsViewModel @Inject constructor(
    private val profileRepository: ProfileRepository,
    jobRepository: JobRepository,
    private val firebaseAuth: FirebaseAuth
) : ViewModel() {

    private val userId = MutableStateFlow<String?>(null)

    val appliedJobs: StateFlow<List<JobPost>> = userId.flatMapLatest { seekerId ->
        seekerId?.let(jobRepository::getAppliedJobs) ?: flowOf(emptyList())
    }
        .catch { error ->
            Log.e("ProfileSettingsViewModel", "Failed to load applied jobs", error)
            emit(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val savedJobs: StateFlow<List<JobPost>> = jobRepository.getSavedJobs()
        .catch { error ->
            Log.e("ProfileSettingsViewModel", "Failed to load saved jobs", error)
            emit(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _uiState = MutableStateFlow(ProfileSettingsUiState())
    val uiState: StateFlow<ProfileSettingsUiState> = _uiState.asStateFlow()

    fun setUserId(seekerId: String) {
        userId.value = seekerId.trim().takeIf(String::isNotEmpty)
        if (userId.value == null) return
        viewModelScope.launch {
            val id = userId.value ?: return@launch
            val p = profileRepository.getSeekerProfile(id)
            if (p != null) {
                _uiState.update { it.copy(profile = p) }
            } else {
                _uiState.update {
                    it.copy(
                        profile = it.profile.copy(
                            userId = id,
                            targetTitle = "",
                            salaryFloor = 0,
                            topSkills = emptyList(),
                            highlights = emptyList(),
                            expectedLocation = ""
                        )
                    )
                }
            }
        }
    }

    fun updateTargetTitle(title: String) {
        _uiState.update { it.copy(profile = it.profile.copy(targetTitle = title), isSaved = false) }
    }

    fun updateSalaryFloor(salary: Int) {
        _uiState.update { it.copy(profile = it.profile.copy(salaryFloor = salary), isSaved = false) }
    }

    fun updateNoticePeriod(noticePeriod: NoticePeriod) {
        _uiState.update { it.copy(profile = it.profile.copy(noticePeriod = noticePeriod), isSaved = false) }
    }

    fun updateTopSkills(skills: String) {
        _uiState.update {
            it.copy(
                profile = it.profile.copy(
                    topSkills = skills.split(",").map(String::trim).filter(String::isNotEmpty)
                ),
                isSaved = false
            )
        }
    }

    fun updateExpectedLocation(location: String) {
        _uiState.update {
            it.copy(
                profile = it.profile.copy(expectedLocation = location),
                isSaved = false
            )
        }
    }

    fun saveProfile() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, message = null) }
            try {
                profileRepository.updateSeekerProfile(
                    _uiState.value.profile.copy(userId = userId.value.orEmpty())
                )
                _uiState.update { it.copy(isLoading = false, isSaved = true, message = "Profile updated") }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e("ProfileSettingsViewModel", "Failed to save profile", error)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.localizedMessage ?: "Could not save your profile."
                    )
                }
            }
        }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            val user = firebaseAuth.currentUser
            val email = user?.email
            if (user == null || email.isNullOrBlank()) {
                _uiState.update { it.copy(errorMessage = "Sign in again before changing your password.") }
                return@launch
            }
            if (user.providerData.none { it.providerId == "password" }) {
                _uiState.update {
                    it.copy(errorMessage = "This account uses Google sign-in. Use password reset to set a password.")
                }
                return@launch
            }
            if (currentPassword.isBlank() || newPassword.length < 6) {
                _uiState.update {
                    it.copy(errorMessage = "Enter your current password and a new password of at least 6 characters.")
                }
                return@launch
            }

            _uiState.update { it.copy(isLoading = true, errorMessage = null, message = null) }
            try {
                val credential = EmailAuthProvider.getCredential(email, currentPassword)
                user.reauthenticate(credential).await()
                user.updatePassword(newPassword).await()
                _uiState.update { it.copy(isLoading = false, message = "Password updated") }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e("ProfileSettingsViewModel", "Failed to update password", error)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.localizedMessage ?: "Could not update your password."
                    )
                }
            }
        }
    }

    fun sendPasswordReset() {
        val email = firebaseAuth.currentUser?.email
        if (email.isNullOrBlank()) {
            _uiState.update { it.copy(errorMessage = "No email address is associated with this account.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, message = null) }
            try {
                firebaseAuth.sendPasswordResetEmail(email).await()
                _uiState.update {
                    it.copy(isLoading = false, message = "Password reset email sent to $email")
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e("ProfileSettingsViewModel", "Failed to send password reset email", error)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.localizedMessage ?: "Could not send password reset email."
                    )
                }
            }
        }
    }

    fun signOut(onComplete: () -> Unit) {
        firebaseAuth.signOut()
        onComplete()
    }
}

