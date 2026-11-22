package com.fireflylabz.devaitjobs.data.repository

import android.util.Log
import com.fireflylabz.devaitjobs.data.local.ApplicationDao
import com.fireflylabz.devaitjobs.data.local.ApplicationEntity
import com.fireflylabz.devaitjobs.data.local.JobDao
import com.fireflylabz.devaitjobs.data.local.JobEntity
import com.fireflylabz.devaitjobs.data.local.OfflineActionEntity
import com.fireflylabz.devaitjobs.data.local.SyncDao
import com.fireflylabz.devaitjobs.data.local.SkippedJobDao
import com.fireflylabz.devaitjobs.data.local.SkippedJobEntity
import com.fireflylabz.devaitjobs.domain.model.Application
import com.fireflylabz.devaitjobs.domain.model.ApplicationStatus
import com.fireflylabz.devaitjobs.domain.model.JobPost
import com.fireflylabz.devaitjobs.domain.model.RejectionReason
import com.fireflylabz.devaitjobs.domain.model.WorkMode
import com.fireflylabz.devaitjobs.domain.repository.JobRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class JobRepositoryImpl @Inject constructor(
    private val jobDao: JobDao,
    private val applicationDao: ApplicationDao,
    private val syncDao: SyncDao,
    private val skippedJobDao: SkippedJobDao,
    private val supabaseClient: SupabaseClient
) : JobRepository {

    override fun getJobFeed(seekerId: String): Flow<List<JobPost>> {
        val availableJobs = combine(
            jobDao.getAllJobs(),
            applicationDao.getAppliedJobIds(seekerId),
            skippedJobDao.getSkippedJobIds(seekerId)
        ) { jobs, appliedJobIds, skippedJobIds ->
            val excludedJobIds = appliedJobIds.toSet() + skippedJobIds
            jobs.filterNot { it.id in excludedJobIds }.map { it.toDomain() }
        }

        return availableJobs
            .onStart {
                try {
                    refreshJobsFromSupabase()
                } catch (e: Exception) {
                    if (e is CancellationException) throw e

                    Log.e("JobRepository", "Failed to fetch jobs from Supabase", e)
                    if (jobDao.getAllJobs().first().isEmpty()) throw e
                }
            }
    }

    override fun getSavedJobs(): Flow<List<JobPost>> =
        jobDao.getSavedJobs().map { entities -> entities.map { it.toDomain() } }

    override fun getAppliedJobs(seekerId: String): Flow<List<JobPost>> =
        combine(
            applicationDao.getSeekerApplications(seekerId),
            jobDao.getAllJobs()
        ) { applications, jobs ->
            val appliedJobIds = applications.mapTo(mutableSetOf()) { it.jobId }
            jobs.filter { it.id in appliedJobIds }.map { it.toDomain() }
        }

    private suspend fun refreshJobsFromSupabase() {
        val savedJobIds = jobDao.getSavedJobIds().toSet()
        val jobs = supabaseClient.from("jobs").select(
            columns = Columns.list(
                "id",
                "title",
                "company",
                "location",
                "work_style",
                "min_experience",
                "max_experience",
                "required_skills",
                "description_text",
                "apply_url",
                "posted_at"
            )
        ) {
            filter { eq("is_active", true) }
            order("posted_at", Order.DESCENDING)
        }.decodeList<SupabaseJobRow>()

        jobDao.replaceJobs(jobs.map { it.toEntity().copy(isSaved = it.id in savedJobIds) })
    }

    override suspend fun setJobSaved(jobId: String, isSaved: Boolean) {
        jobDao.setSaved(jobId, isSaved)
    }

    override suspend fun skipJob(seekerId: String, jobId: String) {
        skippedJobDao.insertSkippedJob(SkippedJobEntity(seekerId = seekerId, jobId = jobId))
    }

    override suspend fun getJobById(id: String): JobPost? {
        // Assume repository relies on local cache populated from Supabase
        return null
    }

    override suspend fun postJob(jobPost: JobPost) {
        // Save locally and attempt remote sync
        jobDao.insertJobs(listOf(jobPost.toEntity()))
        try {
            supabaseClient.from("jobs").insert(jobPost)
        } catch (e: Exception) {
            syncDao.addAction(
                OfflineActionEntity(
                    actionType = "POST_JOB",
                    payloadJson = Json.encodeToString(jobPost)
                )
            )
        }
    }

    override suspend fun applyForJob(application: Application) {
        applicationDao.insertApplication(application.toEntity())
        try {
            supabaseClient.from("applications").insert(application)
        } catch (e: Exception) {
            syncDao.addAction(
                OfflineActionEntity(
                    actionType = "APPLY_JOB",
                    payloadJson = Json.encodeToString(application)
                )
            )
        }
    }

    override fun getSeekerApplications(seekerId: String): Flow<List<Application>> {
        return applicationDao.getSeekerApplications(seekerId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun getJobApplications(jobId: String): Flow<List<Application>> {
        return applicationDao.getJobApplications(jobId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override suspend fun updateApplicationStatus(
        applicationId: String,
        status: ApplicationStatus,
        reason: RejectionReason?
    ) {
        applicationDao.updateStatus(applicationId, status, reason, System.currentTimeMillis())
        try {
            // Remote update if connected
        } catch (e: Exception) {
            // Queue sync
        }
    }

    private fun JobEntity.toDomain() = JobPost(
        id = id,
        companyId = companyId,
        companyName = companyName,
        companyLogoUrl = companyLogoUrl,
        title = title,
        salaryMin = salaryMin,
        salaryMax = salaryMax,
        workMode = workMode,
        coreSkills = coreSkills,
        teamObjective = teamObjective,
        status = status,
        knockoutQuestions = knockoutQuestions,
        verifiedCompany = verifiedCompany,
        location = location,
        minExperience = minExperience,
        maxExperience = maxExperience,
        applyUrl = applyUrl,
        postedAt = postedAt,
        isSaved = isSaved
    )

    private fun JobPost.toEntity() = JobEntity(
        id = id,
        companyId = companyId,
        companyName = companyName,
        companyLogoUrl = companyLogoUrl,
        title = title,
        salaryMin = salaryMin,
        salaryMax = salaryMax,
        workMode = workMode,
        coreSkills = coreSkills,
        teamObjective = teamObjective,
        status = status,
        knockoutQuestions = knockoutQuestions,
        verifiedCompany = verifiedCompany,
        location = location,
        minExperience = minExperience,
        maxExperience = maxExperience,
        applyUrl = applyUrl,
        postedAt = postedAt,
        isSaved = isSaved
    )

    private fun SupabaseJobRow.toEntity() = JobEntity(
        id = id,
        companyId = company,
        companyName = company,
        companyLogoUrl = null,
        title = title,
        salaryMin = 0,
        salaryMax = 0,
        workMode = workStyle.toWorkMode(),
        coreSkills = requiredSkills,
        teamObjective = descriptionText,
        status = com.fireflylabz.devaitjobs.domain.model.JobStatus.OPEN,
        knockoutQuestions = emptyList(),
        verifiedCompany = false,
        location = location,
        minExperience = minExperience,
        maxExperience = maxExperience,
        applyUrl = applyUrl,
        postedAt = postedAt
    )

    private fun String?.toWorkMode(): WorkMode = when (this) {
        "Remote" -> WorkMode.REMOTE
        "Hybrid" -> WorkMode.HYBRID
        "Onsite" -> WorkMode.ONSITE
        else -> WorkMode.UNSPECIFIED
    }

    private fun ApplicationEntity.toDomain() = Application(
        id = id,
        jobId = jobId,
        seekerId = seekerId,
        status = status,
        pitchNote = pitchNote,
        declineReason = declineReason,
        lastActivityAt = lastActivityAt,
        knockoutAnswers = knockoutAnswers
    )

    private fun Application.toEntity() = ApplicationEntity(
        id = id,
        jobId = jobId,
        seekerId = seekerId,
        status = status,
        pitchNote = pitchNote,
        declineReason = declineReason,
        lastActivityAt = lastActivityAt,
        knockoutAnswers = knockoutAnswers
    )
}

@Serializable
private data class SupabaseJobRow(
    val id: String,
    val title: String,
    val company: String,
    val location: String? = null,
    @SerialName("work_style") val workStyle: String? = null,
    @SerialName("min_experience") val minExperience: Int? = null,
    @SerialName("max_experience") val maxExperience: Int? = null,
    @SerialName("required_skills") val requiredSkills: List<String> = emptyList(),
    @SerialName("description_text") val descriptionText: String,
    @SerialName("apply_url") val applyUrl: String,
    @SerialName("posted_at") val postedAt: String? = null
)

