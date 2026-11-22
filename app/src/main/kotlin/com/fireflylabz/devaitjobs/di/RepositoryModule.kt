package com.fireflylabz.devaitjobs.di

import com.fireflylabz.devaitjobs.data.repository.JobRepositoryImpl
import com.fireflylabz.devaitjobs.data.repository.ProfileRepositoryImpl
import com.fireflylabz.devaitjobs.domain.repository.JobRepository
import com.fireflylabz.devaitjobs.domain.repository.ProfileRepository
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

