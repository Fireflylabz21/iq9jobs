package com.example.brevityjobs.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.example.brevityjobs.domain.model.JobStatus
import com.example.brevityjobs.domain.model.WorkMode

@Entity(tableName = "jobs")
data class JobEntity(
    @PrimaryKey val id: String,
    val companyId: String,
    val companyName: String,
    val companyLogoUrl: String?,
    val title: String,
    val salaryMin: Int,
    val salaryMax: Int,
    val workMode: WorkMode,
    val coreSkills: List<String>,
    val teamObjective: String,
    val status: JobStatus,
    val knockoutQuestions: List<String>,
    val verifiedCompany: Boolean,
    val location: String? = null,
    val minExperience: Int? = null,
    val maxExperience: Int? = null,
    val applyUrl: String? = null,
    val postedAt: String? = null,
    val isSaved: Boolean = false,
    val cachedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "offline_sync_queue")
data class OfflineActionEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val actionType: String, // "APPLY", "SWIPE_PASS", "SWIPE_SAVE"
    val payloadJson: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "skipped_jobs",
    primaryKeys = ["seekerId", "jobId"]
)
data class SkippedJobEntity(
    val seekerId: String,
    val jobId: String,
    val skippedAt: Long = System.currentTimeMillis()
)
