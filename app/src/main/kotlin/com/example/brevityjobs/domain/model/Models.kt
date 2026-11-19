package com.example.brevityjobs.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class UserRole {
    SEEKER, RECRUITER
}

@Serializable
data class User(
    val id: String,
    val email: String,
    val role: UserRole,
    val incognitoDomains: List<String> = emptyList()
)

@Serializable
enum class NoticePeriod {
    IMMEDIATE, LESS_THAN_15_DAYS, THIRTY_DAYS, SIXTY_PLUS_DAYS
}

@Serializable
data class SeekerProfile(
    val userId: String,
    val targetTitle: String,
    val salaryFloor: Int,
    val noticePeriod: NoticePeriod,
    val topSkills: List<String>, // Max 6
    val highlights: List<String>, // Max 3, max 140 chars each
    val expectedLocation: String = ""
)

@Serializable
data class AgentOnboardingDetails(
    val fullName: String,
    val email: String,
    val phoneNumber: String,
    val primarySkillsets: String,
    val targetRole: String,
    val yearsExperience: Int,
    val currentCompany: String,
    val currentLocation: String,
    val expectedLocation: String,
    val noticePeriod: String
)

@Serializable
data class Company(
    val id: String,
    val name: String,
    val domain: String,
    val fastResponderSla: Boolean = false
)

@Serializable
enum class WorkMode {
    REMOTE, HYBRID, ONSITE, UNSPECIFIED
}

@Serializable
enum class JobStatus {
    OPEN, CLOSED, ARCHIVED
}

@Serializable
data class JobPost(
    val id: String,
    val companyId: String,
    val companyName: String,
    val companyLogoUrl: String? = null,
    val title: String,
    val salaryMin: Int,
    val salaryMax: Int,
    val workMode: WorkMode,
    val coreSkills: List<String>, // Exactly 3
    val teamObjective: String,
    val status: JobStatus = JobStatus.OPEN,
    val knockoutQuestions: List<String> = emptyList(),
    val verifiedCompany: Boolean = false,
    val location: String? = null,
    val minExperience: Int? = null,
    val maxExperience: Int? = null,
    val applyUrl: String? = null,
    val postedAt: String? = null,
    val isSaved: Boolean = false
)

@Serializable
enum class ApplicationStatus {
    SUBMITTED, VIEWED, SHORTLISTED, INTERVIEW_SCHEDULED, OFFER, ARCHIVED
}

@Serializable
enum class RejectionReason {
    NOTICE_PERIOD_MISMATCH,
    COMPENSATION_EXPECTATION_OUT_OF_RANGE,
    BETTER_TECH_STACK_FIT,
    OTHER
}

@Serializable
data class Application(
    val id: String,
    val jobId: String,
    val seekerId: String,
    val status: ApplicationStatus = ApplicationStatus.SUBMITTED,
    val pitchNote: String? = null, // Max 140 chars
    val declineReason: RejectionReason? = null,
    val lastActivityAt: Long = System.currentTimeMillis(),
    val knockoutAnswers: List<String> = emptyList()
)
