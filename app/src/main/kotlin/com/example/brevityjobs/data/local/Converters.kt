package com.example.brevityjobs.data.local

import androidx.room.TypeConverter
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class Converters {
    @TypeConverter
    fun fromStringList(value: List<String>): String = Json.encodeToString(value)

    @TypeConverter
    fun toStringList(value: String): List<String> = Json.decodeFromString(value)

    @TypeConverter
    fun fromWorkMode(value: com.example.brevityjobs.domain.model.WorkMode): String = value.name

    @TypeConverter
    fun toWorkMode(value: String): com.example.brevityjobs.domain.model.WorkMode = com.example.brevityjobs.domain.model.WorkMode.valueOf(value)

    @TypeConverter
    fun fromJobStatus(value: com.example.brevityjobs.domain.model.JobStatus): String = value.name

    @TypeConverter
    fun toJobStatus(value: String): com.example.brevityjobs.domain.model.JobStatus = com.example.brevityjobs.domain.model.JobStatus.valueOf(value)
}
