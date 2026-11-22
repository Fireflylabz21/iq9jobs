package com.fireflylabz.devaitjobs.ui.seeker.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.util.Log
import com.fireflylabz.devaitjobs.domain.model.Application
import com.fireflylabz.devaitjobs.domain.model.ApplicationStatus
import com.fireflylabz.devaitjobs.domain.model.JobPost
import com.fireflylabz.devaitjobs.domain.model.SeekerProfile
import com.fireflylabz.devaitjobs.domain.repository.JobRepository
import com.fireflylabz.devaitjobs.domain.repository.ProfileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.ExperimentalCoroutinesApi

sealed interface SeekerFeedUiState {
    object Loading : SeekerFeedUiState
    data class Success(val jobs: List<JobPost>) : SeekerFeedUiState
    data class Error(val message: String) : SeekerFeedUiState
}

@HiltViewModel
@OptIn(ExperimentalCoroutinesApi::class)
class SeekerFeedViewModel @Inject constructor(
    private val jobRepository: JobRepository,
    profileRepository: ProfileRepository
) : ViewModel() {

    private val profileRequest = MutableStateFlow<Pair<String?, Int>>(null to 0)

    val uiState: StateFlow<SeekerFeedUiState> = combine(
        profileRequest.flatMapLatest { (userId, _) ->
            userId?.let(jobRepository::getJobFeed) ?: flowOf(emptyList())
        },
        profileRequest.flatMapLatest { (userId, _) ->
            flow<SeekerProfile?> {
                emit(userId?.let { profileRepository.getSeekerProfile(it) })
            }
        }
    ) { jobs, profile ->
        val matchedJobs = if (profile == null) {
            emptyList()
        } else {
            RelatedJobMatcher.match(jobs, profile)
        }
        val state: SeekerFeedUiState = SeekerFeedUiState.Success(matchedJobs)
        state
    }
        .catch { error ->
            emit(SeekerFeedUiState.Error(error.message ?: "Failed to load jobs"))
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = SeekerFeedUiState.Loading
        )

    fun setSeekerId(userId: String?) {
        profileRequest.value = (userId?.trim()?.takeIf(String::isNotEmpty)) to profileRequest.value.second
    }

    fun refreshProfile() {
        profileRequest.value = profileRequest.value.let { (userId, revision) -> userId to revision + 1 }
    }

    fun setJobSaved(jobId: String, isSaved: Boolean) {
        viewModelScope.launch {
            try {
                jobRepository.setJobSaved(jobId, isSaved)
            } catch (error: Exception) {
                Log.e("SeekerFeedViewModel", "Failed to update saved job state for $jobId", error)
            }
        }
    }

    fun skipJob(job: JobPost) {
        viewModelScope.launch {
            val userId = profileRequest.value.first ?: return@launch
            try {
                jobRepository.skipJob(userId, job.id)
            } catch (error: Exception) {
                Log.e("SeekerFeedViewModel", "Failed to save skipped job ${job.id}", error)
            }
        }
    }

    fun recordApplicationStarted(job: JobPost) {
        viewModelScope.launch {
            try {
                jobRepository.applyForJob(
                    Application(
                        id = UUID.randomUUID().toString(),
                        jobId = job.id,
                        seekerId = profileRequest.value.first.orEmpty(),
                        status = ApplicationStatus.SUBMITTED
                    )
                )
            } catch (error: Exception) {
                Log.e("SeekerFeedViewModel", "Failed to record application for ${job.id}", error)
            }
        }
    }
}

