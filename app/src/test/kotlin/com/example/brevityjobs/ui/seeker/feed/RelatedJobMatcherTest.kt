package com.example.brevityjobs.ui.seeker.feed

import com.example.brevityjobs.domain.model.JobPost
import com.example.brevityjobs.domain.model.NoticePeriod
import com.example.brevityjobs.domain.model.SeekerProfile
import com.example.brevityjobs.domain.model.WorkMode
import org.junit.Assert.assertEquals
import org.junit.Test

class RelatedJobMatcherTest {
    @Test
    fun ranksExactMatchesAboveRelatedRolesAndExcludesUnrelatedJobs() {
        val profile = SeekerProfile(
            userId = "candidate@example.com",
            targetTitle = "Android Engineer",
            salaryFloor = 0,
            noticePeriod = NoticePeriod.IMMEDIATE,
            topSkills = listOf("Kotlin", "Jetpack Compose"),
            highlights = emptyList(),
            expectedLocation = "Boston, MA"
        )
        val exact = job("exact", "Android Engineer", listOf("Kotlin"), "Boston, MA")
        val related = job("related", "Mobile Developer", listOf("Java"), "Cambridge, MA")
        val unrelated = job("unrelated", "Backend Engineer", listOf("Go"), "Seattle, WA")

        val result = RelatedJobMatcher.match(listOf(related, unrelated, exact), profile)

        assertEquals(listOf("exact", "related"), result.map(JobPost::id))
    }

    @Test
    fun showsNoJobsWhenProfileHasNoRoleOrSkills() {
        val profile = SeekerProfile(
            userId = "candidate@example.com",
            targetTitle = "",
            salaryFloor = 0,
            noticePeriod = NoticePeriod.IMMEDIATE,
            topSkills = emptyList(),
            highlights = emptyList(),
            expectedLocation = "Boston"
        )
        val localJob = job("local", "Backend Engineer", listOf("Go"), "Boston, MA")

        val result = RelatedJobMatcher.match(listOf(localJob), profile)

        assertEquals(emptyList<String>(), result.map(JobPost::id))
    }

    @Test
    fun matchesPresalesToSalesAndBusinessDevelopmentAndFallsBackFromChennai() {
        val profile = profile(
            role = "Presales",
            skills = listOf("CRM", "Negotiation"),
            location = "Chennai"
        )
        val chennaiSales = job("chennai-sales", "Sales Executive", listOf("CRM"), "Chennai, Tamil Nadu")
        val bangaloreBusinessDev = job(
            "bangalore-bd",
            "Business Development Associate",
            listOf("Negotiation"),
            "Bengaluru"
        )
        val hyderabadPresales = job("hyderabad-presales", "Pre-Sales Consultant", listOf("CRM"), "Hyderabad")
        val unrelatedChennai = job("unrelated", "Backend Engineer", listOf("Go"), "Chennai")

        val withChennaiAvailable = RelatedJobMatcher.match(
            listOf(bangaloreBusinessDev, unrelatedChennai, chennaiSales, hyderabadPresales),
            profile
        )
        assertEquals(listOf("chennai-sales"), withChennaiAvailable.map(JobPost::id))

        val withChennaiUnavailable = RelatedJobMatcher.match(
            listOf(hyderabadPresales, bangaloreBusinessDev),
            profile
        )
        assertEquals(listOf("bangalore-bd"), withChennaiUnavailable.map(JobPost::id))
    }

    @Test
    fun fallsBackToHyderabadWhenNoRelatedChennaiOrBangaloreJobsExist() {
        val profile = profile(
            role = "Presales",
            skills = listOf("CRM"),
            location = "Chennai"
        )
        val unrelatedBangalore = job("unrelated", "Backend Engineer", listOf("Go"), "Bangalore")
        val relatedHyderabad = job("hyderabad", "Sales Development Representative", listOf("CRM"), "Hyderabad")

        val result = RelatedJobMatcher.match(listOf(unrelatedBangalore, relatedHyderabad), profile)

        assertEquals(listOf("hyderabad"), result.map(JobPost::id))
    }

    @Test
    fun prioritizesJobsMatchingRoleAndSkillWithinSelectedCity() {
        val profile = profile("Presales", listOf("CRM"), "Chennai")
        val roleOnly = job("role", "Sales Executive", listOf("Communication"), "Chennai")
        val roleAndSkill = job("both", "Presales Consultant", listOf("CRM"), "Chennai")

        val result = RelatedJobMatcher.match(listOf(roleOnly, roleAndSkill), profile)

        assertEquals(listOf("both", "role"), result.map(JobPost::id))
    }

    private fun profile(role: String, skills: List<String>, location: String) = SeekerProfile(
        userId = "candidate@example.com",
        targetTitle = role,
        salaryFloor = 0,
        noticePeriod = NoticePeriod.IMMEDIATE,
        topSkills = skills,
        highlights = emptyList(),
        expectedLocation = location
    )

    private fun job(
        id: String,
        title: String,
        skills: List<String>,
        location: String?,
        workMode: WorkMode = WorkMode.ONSITE
    ) = JobPost(
        id = id,
        companyId = "company-$id",
        companyName = "Company",
        title = title,
        salaryMin = 0,
        salaryMax = 0,
        workMode = workMode,
        coreSkills = skills,
        teamObjective = "",
        location = location
    )
}
