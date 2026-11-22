package com.fireflylabz.devaitjobs.data.repository

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import com.fireflylabz.devaitjobs.domain.model.NoticePeriod
import com.fireflylabz.devaitjobs.domain.model.AgentOnboardingDetails
import com.fireflylabz.devaitjobs.domain.model.SeekerProfile
import com.fireflylabz.devaitjobs.domain.model.User
import com.fireflylabz.devaitjobs.domain.model.UserRole
import com.fireflylabz.devaitjobs.domain.repository.ProfileRepository
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProfileRepositoryImpl @Inject constructor(
    @ApplicationContext context: Context,
    private val firebaseAuth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) : ProfileRepository {
    private val preferences = context.getSharedPreferences("seeker_profiles", Context.MODE_PRIVATE)
    private val onboardingPreferences =
        context.getSharedPreferences("agent_onboarding", Context.MODE_PRIVATE)

    override suspend fun getSeekerProfile(userId: String): SeekerProfile? {
        val local = preferences.getString(userId.lowercase(), null)
            ?.let { Json.decodeFromString<SeekerProfile>(it) }
        val user = firebaseAuth.currentUser ?: return local
        if (!user.email.equals(userId, ignoreCase = true)) return local

        val storedProfile = firestore.collection("users")
            .document(user.uid)
            .get()
            .await()
            .get("seekerProfile") as? Map<*, *>
            ?: return local
        return storedProfile.toSeekerProfile(userId).also { saveLocally(it) }
    }

    override suspend fun updateSeekerProfile(profile: SeekerProfile) {
        saveLocally(profile)
        val user = firebaseAuth.currentUser ?: return
        if (!user.email.equals(profile.userId, ignoreCase = true)) return

        firestore.collection("users")
            .document(user.uid)
            .set(
                mapOf(
                    "uid" to user.uid,
                    "email" to user.email.orEmpty(),
                    "seekerProfile" to profile.toFirestoreMap()
                ),
                com.google.firebase.firestore.SetOptions.merge()
            )
            .await()
    }

    override suspend fun hasCompletedOnboarding(userId: String): Boolean {
        val key = userId.lowercase()
        if (onboardingPreferences.getBoolean(key, false)) return true

        val user = firebaseAuth.currentUser ?: return false
        if (!user.email.equals(userId, ignoreCase = true)) return false
        val document = firestore.collection("users").document(user.uid).get().await()
        val completed = document.getBoolean("onboardingCompleted") == true ||
            document.get("agentDetails") is Map<*, *> ||
            document.get("seekerProfile") is Map<*, *>
        if (completed) onboardingPreferences.edit().putBoolean(key, true).apply()
        return completed
    }

    override suspend fun saveAgentOnboardingDetails(userId: String, details: AgentOnboardingDetails) {
        val user = firebaseAuth.currentUser
        if (user == null || !user.email.equals(userId, ignoreCase = true)) {
            throw IllegalStateException("The signed-in account does not match the onboarding profile.")
        }

        val detailsMap = mapOf(
            "fullName" to details.fullName,
            "email" to details.email,
            "phoneNumber" to details.phoneNumber,
            "primarySkillsets" to details.primarySkillsets,
            "targetRole" to details.targetRole,
            "yearsExperience" to details.yearsExperience,
            "currentCompany" to details.currentCompany,
            "currentLocation" to details.currentLocation,
            "expectedLocation" to details.expectedLocation,
            "noticePeriod" to details.noticePeriod
        )
        firestore.collection("users")
            .document(user.uid)
            .set(
                mapOf(
                    "uid" to user.uid,
                    "email" to user.email.orEmpty(),
                    "agentDetails" to detailsMap,
                    "onboardingCompleted" to true
                ),
                com.google.firebase.firestore.SetOptions.merge()
            )
            .await()

        check(onboardingPreferences.edit().putBoolean(userId.lowercase(), true).commit()) {
            "Saved onboarding in Firestore but failed to save its local completion marker"
        }
    }

    private fun saveLocally(profile: SeekerProfile) {
        check(preferences.edit().putString(profile.userId.lowercase(), Json.encodeToString(profile)).commit()) {
            "Failed to save seeker profile locally"
        }
    }

    private fun Map<*, *>.toSeekerProfile(userId: String) = SeekerProfile(
        userId = userId,
        targetTitle = this["targetTitle"] as? String ?: "",
        salaryFloor = (this["salaryFloor"] as? Number)?.toInt() ?: 0,
        noticePeriod = (this["noticePeriod"] as? String)
            ?.let { runCatching { NoticePeriod.valueOf(it) }.getOrNull() }
            ?: NoticePeriod.IMMEDIATE,
        topSkills = (this["topSkills"] as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
        highlights = (this["highlights"] as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
        expectedLocation = this["expectedLocation"] as? String ?: ""
    )

    private fun SeekerProfile.toFirestoreMap() = mapOf(
        "targetTitle" to targetTitle,
        "salaryFloor" to salaryFloor,
        "noticePeriod" to noticePeriod.name,
        "topSkills" to topSkills,
        "highlights" to highlights,
        "expectedLocation" to expectedLocation
    )

    override suspend fun getCurrentUser(): Flow<User?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { auth ->
            val firebaseUser = auth.currentUser
            trySend(
                firebaseUser?.let {
                    User(
                        id = it.uid,
                        email = it.email.orEmpty(),
                        role = UserRole.SEEKER
                    )
                }
            )
        }
        firebaseAuth.addAuthStateListener(listener)
        awaitClose { firebaseAuth.removeAuthStateListener(listener) }
    }
}

