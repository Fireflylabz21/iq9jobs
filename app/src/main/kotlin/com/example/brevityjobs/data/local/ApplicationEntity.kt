package com.example.brevityjobs.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.example.brevityjobs.domain.model.ApplicationStatus
import com.example.brevityjobs.domain.model.RejectionReason

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
