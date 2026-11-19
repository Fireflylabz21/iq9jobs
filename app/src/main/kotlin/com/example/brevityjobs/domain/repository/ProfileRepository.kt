package com.example.brevityjobs.domain.repository

import com.example.brevityjobs.domain.model.SeekerProfile
import com.example.brevityjobs.domain.model.AgentOnboardingDetails
import com.example.brevityjobs.domain.model.User
import kotlinx.coroutines.flow.Flow

interface ProfileRepository {
    suspend fun getSeekerProfile(userId: String): SeekerProfile?
    suspend fun updateSeekerProfile(profile: SeekerProfile)
    suspend fun hasCompletedOnboarding(userId: String): Boolean
    suspend fun saveAgentOnboardingDetails(userId: String, details: AgentOnboardingDetails)
    suspend fun getCurrentUser(): Flow<User?>
}
