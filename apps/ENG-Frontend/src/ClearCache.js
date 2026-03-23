import React, {useState, useEffect} from 'react'
import packageJson from '../package.json'
import moment from 'moment'

const buildDateGreaterThan = (latestDate, currentDate) => {
    const momLatestDateTime = moment(latestDate)
    const momCurrentDateTime = moment(currentDate)

    if (momLatestDateTime.isAfter(momCurrentDateTime)) {
        return true
    } else {
        return false
    }
}

function WithClearCache() {
    let isLatestBuildDate = false
    fetch("/meta.json").then((res => res.json()).then((meta) => {
        const latestVersionDate = meta.buildDate;
        const currentVersionDate = packageJson.buildDate;

        const shouldForceRefresh = buildDateGreaterThan(latestVersionDate, currentVersionDate);
        if (shouldForceRefresh) {
            isLatestBuildDate = false;
        } else {
            isLatestBuildDate = true;
        }
    }))

    return isLatestBuildDate
}

export default WithClearCache

