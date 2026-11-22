package com.fireflylabz.devaitjobs.domain.repository

import com.fireflylabz.devaitjobs.domain.model.Application
import com.fireflylabz.devaitjobs.domain.model.JobPost
import kotlinx.coroutines.flow.Flow

interface JobRepository {
    fun getJobFeed(seekerId: String): Flow<List<JobPost>>
    fun getSavedJobs(): Flow<List<JobPost>>
    fun getAppliedJobs(seekerId: String): Flow<List<JobPost>>
    suspend fun getJobById(id: String): JobPost?
    suspend fun setJobSaved(jobId: String, isSaved: Boolean)
    suspend fun skipJob(seekerId: String, jobId: String)
    suspend fun postJob(jobPost: JobPost)
    suspend fun applyForJob(application: Application)
    fun getSeekerApplications(seekerId: String): Flow<List<Application>>
    fun getJobApplications(jobId: String): Flow<List<Application>>
    suspend fun updateApplicationStatus(applicationId: String, status: com.fireflylabz.devaitjobs.domain.model.ApplicationStatus, reason: com.fireflylabz.devaitjobs.domain.model.RejectionReason? = null)
}

