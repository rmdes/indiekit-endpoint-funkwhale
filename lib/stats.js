/**
 * Get date match filter for a time period
 * @param {string} period - 'all', 'week', or 'month'
 * @returns {object} - MongoDB match filter
 */
function getDateMatch(period) {
  const now = new Date();
  let threshold = null;

  switch (period) {
    case "week":
      threshold = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      threshold = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      return {};
  }

  // Use $toDate to handle both ISO string and Date listenedAt values
  return {
    $expr: {
      $gte: [{ $toDate: "$listenedAt" }, threshold],
    },
  };
}

/**
 * Get top artists for a time period
 * @param {object} db - MongoDB database
 * @param {string} period - 'all', 'week', or 'month'
 * @param {number} limit - Number of artists to return
 * @returns {Promise<Array>} - Top artists
 */
export async function getTopArtists(db, period = "all", limit = 10) {
  const match = getDateMatch(period);
  const collection = db.collection("listenings");

  return collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: "$artistId",
          name: { $first: "$artistName" },
          playCount: { $sum: 1 },
          totalDuration: { $sum: "$duration" },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { playCount: -1 } },
      { $limit: limit },
    ])
    .toArray();
}

/**
 * Get top albums for a time period
 * @param {object} db - MongoDB database
 * @param {string} period - 'all', 'week', or 'month'
 * @param {number} limit - Number of albums to return
 * @returns {Promise<Array>} - Top albums
 */
export async function getTopAlbums(db, period = "all", limit = 10) {
  const match = getDateMatch(period);
  const collection = db.collection("listenings");

  return collection
    .aggregate([
      { $match: { ...match, albumId: { $ne: null } } },
      {
        $group: {
          _id: "$albumId",
          title: { $first: "$albumTitle" },
          artist: { $first: "$artistName" },
          coverUrl: { $first: "$coverUrl" },
          playCount: { $sum: 1 },
          totalDuration: { $sum: "$duration" },
        },
      },
      { $sort: { playCount: -1 } },
      { $limit: limit },
    ])
    .toArray();
}

/**
 * Get listening trends (daily counts)
 * @param {object} db - MongoDB database
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} - Daily listening counts
 */
export async function getListeningTrends(db, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const collection = db.collection("listenings");

  return collection
    .aggregate([
      {
        $addFields: {
          listenedAtDate: { $toDate: "$listenedAt" },
        },
      },
      { $match: { listenedAtDate: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$listenedAtDate" },
          },
          count: { $sum: 1 },
          duration: { $sum: "$duration" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1,
          duration: 1,
        },
      },
    ])
    .toArray();
}

/**
 * Get summary statistics for a time period
 * @param {object} db - MongoDB database
 * @param {string} period - 'all', 'week', or 'month'
 * @returns {Promise<object>} - Summary stats
 */
export async function getSummary(db, period = "all") {
  const match = getDateMatch(period);
  const collection = db.collection("listenings");

  const result = await collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: 1 },
          totalDuration: { $sum: "$duration" },
          uniqueTracks: { $addToSet: "$trackId" },
          uniqueArtists: { $addToSet: "$artistId" },
          uniqueAlbums: { $addToSet: "$albumId" },
        },
      },
      {
        $project: {
          _id: 0,
          totalPlays: 1,
          totalDuration: 1,
          uniqueTracks: { $size: "$uniqueTracks" },
          uniqueArtists: {
            $size: {
              $filter: {
                input: "$uniqueArtists",
                cond: { $ne: ["$$this", null] },
              },
            },
          },
          uniqueAlbums: {
            $size: {
              $filter: {
                input: "$uniqueAlbums",
                cond: { $ne: ["$$this", null] },
              },
            },
          },
        },
      },
    ])
    .toArray();

  return (
    result[0] || {
      totalPlays: 0,
      totalDuration: 0,
      uniqueTracks: 0,
      uniqueArtists: 0,
      uniqueAlbums: 0,
    }
  );
}

/**
 * Get all stats for all time periods
 * @param {object} db - MongoDB database
 * @param {object} limits - Limits for top lists
 * @returns {Promise<object>} - All stats
 */
export async function getAllStats(db, limits = {}) {
  const topArtistsLimit = limits.topArtists || 10;
  const topAlbumsLimit = limits.topAlbums || 10;

  const [
    summaryAll,
    summaryMonth,
    summaryWeek,
    topArtistsAll,
    topArtistsMonth,
    topArtistsWeek,
    topAlbumsAll,
    topAlbumsMonth,
    topAlbumsWeek,
    trends,
  ] = await Promise.all([
    getSummary(db, "all"),
    getSummary(db, "month"),
    getSummary(db, "week"),
    getTopArtists(db, "all", topArtistsLimit),
    getTopArtists(db, "month", topArtistsLimit),
    getTopArtists(db, "week", topArtistsLimit),
    getTopAlbums(db, "all", topAlbumsLimit),
    getTopAlbums(db, "month", topAlbumsLimit),
    getTopAlbums(db, "week", topAlbumsLimit),
    getListeningTrends(db, 30),
  ]);

  return {
    summary: {
      all: summaryAll,
      month: summaryMonth,
      week: summaryWeek,
    },
    topArtists: {
      all: topArtistsAll,
      month: topArtistsMonth,
      week: topArtistsWeek,
    },
    topAlbums: {
      all: topAlbumsAll,
      month: topAlbumsMonth,
      week: topAlbumsWeek,
    },
    trends,
  };
}
