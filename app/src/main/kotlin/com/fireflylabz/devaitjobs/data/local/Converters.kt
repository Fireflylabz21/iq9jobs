package com.fireflylabz.devaitjobs.data.local

import androidx.room.TypeConverter
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class Converters {
    @TypeConverter
    fun fromStringList(value: List<String>): String = Json.encodeToString(value)

    @TypeConverter
    fun toStringList(value: String): List<String> = Json.decodeFromString(value)

    @TypeConverter
    fun fromWorkMode(value: com.fireflylabz.devaitjobs.domain.model.WorkMode): String = value.name

    @TypeConverter
    fun toWorkMode(value: String): com.fireflylabz.devaitjobs.domain.model.WorkMode = com.fireflylabz.devaitjobs.domain.model.WorkMode.valueOf(value)

    @TypeConverter
    fun fromJobStatus(value: com.fireflylabz.devaitjobs.domain.model.JobStatus): String = value.name

    @TypeConverter
    fun toJobStatus(value: String): com.fireflylabz.devaitjobs.domain.model.JobStatus = com.fireflylabz.devaitjobs.domain.model.JobStatus.valueOf(value)
}

