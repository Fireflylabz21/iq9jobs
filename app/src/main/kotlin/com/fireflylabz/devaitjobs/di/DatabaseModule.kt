package com.fireflylabz.devaitjobs.di

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.fireflylabz.devaitjobs.data.local.ApplicationDao
import com.fireflylabz.devaitjobs.data.local.BrevityDatabase
import com.fireflylabz.devaitjobs.data.local.JobDao
import com.fireflylabz.devaitjobs.data.local.SyncDao
import com.fireflylabz.devaitjobs.data.local.SkippedJobDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    private val MIGRATION_1_2 = object : Migration(1, 2) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE jobs ADD COLUMN location TEXT")
            database.execSQL("ALTER TABLE jobs ADD COLUMN minExperience INTEGER")
            database.execSQL("ALTER TABLE jobs ADD COLUMN maxExperience INTEGER")
            database.execSQL("ALTER TABLE jobs ADD COLUMN applyUrl TEXT")
            database.execSQL("ALTER TABLE jobs ADD COLUMN postedAt TEXT")
        }
    }

    private val MIGRATION_2_3 = object : Migration(2, 3) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE jobs ADD COLUMN isSaved INTEGER NOT NULL DEFAULT 0")
        }
    }

    private val MIGRATION_3_4 = object : Migration(3, 4) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL(
                "CREATE TABLE IF NOT EXISTS skipped_jobs (" +
                    "seekerId TEXT NOT NULL, " +
                    "jobId TEXT NOT NULL, " +
                    "skippedAt INTEGER NOT NULL, " +
                    "PRIMARY KEY(seekerId, jobId))"
            )
        }
    }

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): BrevityDatabase {
        return Room.databaseBuilder(
            context,
            BrevityDatabase::class.java,
            "brevity_jobs_db"
        ).addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4)
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideJobDao(database: BrevityDatabase): JobDao = database.jobDao()

    @Provides
    fun provideSyncDao(database: BrevityDatabase): SyncDao = database.syncDao()

    @Provides
    fun provideApplicationDao(database: BrevityDatabase): ApplicationDao = database.applicationDao()

    @Provides
    fun provideSkippedJobDao(database: BrevityDatabase): SkippedJobDao = database.skippedJobDao()
}

