package com.example.brevityjobs.di

import com.example.brevityjobs.data.repository.JobRepositoryImpl
import com.example.brevityjobs.data.repository.ProfileRepositoryImpl
import com.example.brevityjobs.domain.repository.JobRepository
import com.example.brevityjobs.domain.repository.ProfileRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindJobRepository(impl: JobRepositoryImpl): JobRepository

    @Binds
    @Singleton
    abstract fun bindProfileRepository(impl: ProfileRepositoryImpl): ProfileRepository
}
