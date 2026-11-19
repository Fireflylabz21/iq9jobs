package com.example.brevityjobs.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters

@Database(
    entities = [
        JobEntity::class,
        OfflineActionEntity::class,
        ApplicationEntity::class,
        SkippedJobEntity::class
    ],
    version = 4,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class BrevityDatabase : RoomDatabase() {
    abstract fun jobDao(): JobDao
    abstract fun syncDao(): SyncDao
    abstract fun applicationDao(): ApplicationDao
    abstract fun skippedJobDao(): SkippedJobDao
}
