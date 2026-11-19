package com.example.brevityjobs.data.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.brevityjobs.data.local.SyncDao
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from

@androidx.hilt.work.HiltWorker
class SyncOfflineActionsWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncDao: SyncDao,
    private val supabaseClient: SupabaseClient
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            val pendingActions = syncDao.getPendingActions()
            for (action in pendingActions) {
                when (action.actionType) {
                    "APPLY_JOB" -> {
                        supabaseClient.from("applications").insert(action.payloadJson)
                    }
                    "POST_JOB" -> {
                        supabaseClient.from("jobs").insert(action.payloadJson)
                    }
                }
                syncDao.removeAction(action.id)
            }
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
