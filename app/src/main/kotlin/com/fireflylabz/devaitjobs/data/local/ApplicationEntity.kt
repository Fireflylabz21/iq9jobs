package com.fireflylabz.devaitjobs.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.fireflylabz.devaitjobs.domain.model.ApplicationStatus
import com.fireflylabz.devaitjobs.domain.model.RejectionReason

@Entity(tableName = "applications")
data class ApplicationEntity(
    @PrimaryKey val id: String,
    val jobId: String,
    val seekerId: String,
    val status: ApplicationStatus,
    val pitchNote: String? = null,
    val declineReason: RejectionReason? = null,
    val lastActivityAt: Long = System.currentTimeMillis(),
    val knockoutAnswers: List<String> = emptyList()
)

