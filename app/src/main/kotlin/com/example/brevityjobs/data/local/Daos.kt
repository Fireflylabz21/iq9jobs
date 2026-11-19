package com.example.brevityjobs.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface ApplicationDao {
    @Query("SELECT * FROM applications WHERE seekerId = :seekerId")
    fun getSeekerApplications(seekerId: String): Flow<List<ApplicationEntity>>

    @Query("SELECT * FROM applications WHERE jobId = :jobId")
    fun getJobApplications(jobId: String): Flow<List<ApplicationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertApplication(application: ApplicationEntity)

    @Query("SELECT jobId FROM applications WHERE seekerId = :seekerId")
    fun getAppliedJobIds(seekerId: String): Flow<List<String>>

    @Query("UPDATE applications SET status = :status, declineReason = :reason, lastActivityAt = :timestamp WHERE id = :id")
    suspend fun updateStatus(id: String, status: com.example.brevityjobs.domain.model.ApplicationStatus, reason: com.example.brevityjobs.domain.model.RejectionReason?, timestamp: Long)
}

@Dao
interface SkippedJobDao {
    @Query("SELECT jobId FROM skipped_jobs WHERE seekerId = :seekerId")
    fun getSkippedJobIds(seekerId: String): Flow<List<String>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertSkippedJob(skippedJob: SkippedJobEntity)
}

@Dao
interface JobDao {
    @Query("SELECT * FROM jobs ORDER BY cachedAt DESC")
    fun getAllJobs(): Flow<List<JobEntity>>

    @Query("SELECT * FROM jobs WHERE isSaved = 1 ORDER BY cachedAt DESC")
    fun getSavedJobs(): Flow<List<JobEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertJobs(jobs: List<JobEntity>)

    @Query("UPDATE jobs SET isSaved = :isSaved WHERE id = :jobId")
    suspend fun setSaved(jobId: String, isSaved: Boolean)

    @Query("SELECT id FROM jobs WHERE isSaved = 1")
    suspend fun getSavedJobIds(): List<String>

    @Query("DELETE FROM jobs")
    suspend fun clearAll()

    @Transaction
    suspend fun replaceJobs(jobs: List<JobEntity>) {
        clearAll()
        insertJobs(jobs)
    }
}

@Dao
interface SyncDao {
    @Insert
    suspend fun addAction(action: OfflineActionEntity)

    @Query("SELECT * FROM offline_sync_queue ORDER BY createdAt ASC")
    suspend fun getPendingActions(): List<OfflineActionEntity>

    @Query("DELETE FROM offline_sync_queue WHERE id = :id")
    suspend fun removeAction(id: Int)
}
