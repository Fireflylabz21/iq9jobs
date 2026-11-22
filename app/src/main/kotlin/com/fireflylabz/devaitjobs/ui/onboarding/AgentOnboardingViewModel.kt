package com.fireflylabz.devaitjobs.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fireflylabz.devaitjobs.data.remote.JobsSupabase
import com.fireflylabz.devaitjobs.domain.model.NoticePeriod
import com.fireflylabz.devaitjobs.domain.model.AgentOnboardingDetails
import com.fireflylabz.devaitjobs.domain.model.SeekerProfile
import com.fireflylabz.devaitjobs.domain.repository.ProfileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import javax.inject.Inject

@Serializable
data class SubscriberDto(
    val full_name: String,
    val email: String,
    val phone_number: String,
    val primary_skillsets: String,
    val secondary_skillsets: String,
    val years_experience: Int,
    val current_company: String,
    val current_ctc: String,
    val notice_period: String,
    val current_location: String,
    val expected_location: String,
    val status: String = "Active"
)

data class AgentOnboardingState(
    val currentStep: Int = 0,
    val fullName: String = "",
    val email: String = "",
    val phoneNumber: String = "",
    val primarySkillsets: String = "",
    val targetRole: String = "",
    val yearsExperience: String = "",
    val currentCompany: String = "",
    val currentLocation: String = "",
    val expectedLocation: String = "",
    val noticePeriod: String = "",
    val isReviewing: Boolean = false,
    val isSubmitting: Boolean = false,
    val isCompleted: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class AgentOnboardingViewModel @Inject constructor(
    private val profileRepository: ProfileRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(AgentOnboardingState())
    val uiState: StateFlow<AgentOnboardingState> = _uiState.asStateFlow()

    fun updateEmail(email: String) {
        _uiState.update { it.copy(email = email) }
    }

    fun handleInput(text: String) {
        val step = _uiState.value.currentStep
        _uiState.update { state ->
            when (step) {
                0 -> state.copy(fullName = text, currentStep = 1)
                1 -> state.copy(phoneNumber = text, currentStep = 2)
                2 -> state.copy(primarySkillsets = text, currentStep = 3)
                3 -> state.copy(targetRole = text, currentStep = 4)
                4 -> state.copy(yearsExperience = text, currentStep = 5)
                5 -> state.copy(currentCompany = text, currentStep = 6)
                6 -> state.copy(currentLocation = text, currentStep = 7)
                7 -> state.copy(expectedLocation = text, currentStep = 8)
                8 -> state.copy(noticePeriod = text, isReviewing = true)
                else -> state
            }
        }
    }

    fun editDetails() {
        _uiState.update { it.copy(isReviewing = false, currentStep = 0) }
    }

    fun submitToSupabase(onComplete: () -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            try {
                val state = _uiState.value
                val dto = SubscriberDto(
                    full_name = state.fullName.trim(),
                    email = state.email.trim(),
                    phone_number = state.phoneNumber.trim(),
                    primary_skillsets = state.primarySkillsets.trim(),
                    secondary_skillsets = "Jetpack Compose, Kotlin",
                    years_experience = state.yearsExperience.toIntOrNull() ?: 0,
                    current_company = state.currentCompany.trim(),
                    current_ctc = "15 LPA",
                    notice_period = state.noticePeriod.trim(),
                    current_location = state.currentLocation.trim(),
                    expected_location = state.expectedLocation.trim()
                )
                JobsSupabase.client.from("subscribers").insert(dto)
                profileRepository.saveAgentOnboardingDetails(
                    userId = state.email.trim(),
                    details = AgentOnboardingDetails(
                        fullName = state.fullName.trim(),
                        email = state.email.trim(),
                        phoneNumber = state.phoneNumber.trim(),
                        primarySkillsets = state.primarySkillsets.trim(),
                        targetRole = state.targetRole.trim(),
                        yearsExperience = state.yearsExperience.toIntOrNull() ?: 0,
                        currentCompany = state.currentCompany.trim(),
                        currentLocation = state.currentLocation.trim(),
                        expectedLocation = state.expectedLocation.trim(),
                        noticePeriod = state.noticePeriod.trim()
                    )
                )
                profileRepository.updateSeekerProfile(
                    SeekerProfile(
                        userId = state.email.trim(),
                        targetTitle = state.targetRole.trim(),
                        salaryFloor = 0,
                        noticePeriod = NoticePeriod.IMMEDIATE,
                        topSkills = state.primarySkillsets.split(",")
                            .map(String::trim)
                            .filter(String::isNotEmpty),
                        highlights = emptyList(),
                        expectedLocation = state.expectedLocation.trim()
                    )
                )

                _uiState.update { it.copy(isSubmitting = false, isCompleted = true) }
                onComplete()
            } catch (e: Exception) {
                android.util.Log.e("AgentOnboarding", "Supabase insert failed", e)
                _uiState.update { it.copy(isSubmitting = false, errorMessage = e.localizedMessage ?: "Submission failed") }
            }
        }
    }
}

