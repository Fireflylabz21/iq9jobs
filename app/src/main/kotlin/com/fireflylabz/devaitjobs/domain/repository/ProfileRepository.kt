package com.fireflylabz.devaitjobs.domain.repository

import com.fireflylabz.devaitjobs.domain.model.SeekerProfile
import com.fireflylabz.devaitjobs.domain.model.AgentOnboardingDetails
import com.fireflylabz.devaitjobs.domain.model.User
import kotlinx.coroutines.flow.Flow

interface ProfileRepository {
    suspend fun getSeekerProfile(userId: String): SeekerProfile?
    suspend fun updateSeekerProfile(profile: SeekerProfile)
    suspend fun hasCompletedOnboarding(userId: String): Boolean
    suspend fun saveAgentOnboardingDetails(userId: String, details: AgentOnboardingDetails)
    suspend fun getCurrentUser(): Flow<User?>
}

