import moment from "moment";

export function getUniqueListBy(arr, key) {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
}

export function uniqueArray(objects, uniqueBy, keepFirst = true) {
  return Array.from(
      objects.reduce((map, e) => {
          let key = uniqueBy.map(key => [e[key], typeof e[key]]).flat().join('-')
          if (keepFirst && map.has(key)) return map
          return map.set(key, e)
      }, new Map()).values()
  )
}

export function addComma(x) {
  const fixedNumber = Number.parseFloat(x).toFixed(2);
  return String(fixedNumber).replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

export function addCommaWithDecimal(x, y) {
  const fixedNumber = Number.parseFloat(x).toFixed(y);
  return String(fixedNumber).replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

export function addCommaNotFloat(x) {
  const fixedNumber = Number.parseInt(x);
  return String(fixedNumber).replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

export function padWithLeadingZeros(num, totalLength) {
  return String(num).padStart(totalLength, '0');
}

export function months(config) {
  var cfg = config || {};
  var count = cfg.count || 12;
  var section = cfg.section;
  var values = [];
  var i, value;

  for (i = 0; i < count; ++i) {
    value = MONTHS[Math.ceil(i) % 12];
    values.push(value.substring(0, section));
  }

  return values;
}

const MONTHS = [
  // "January",
  // "February",
  // "March",
  // "April",
  // "May",
  // "June",
  // "July",
  // "August",
  // "September",
  // "October",
  // "November",
  // "December",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
];

export const CHART_COLORS = {
  red: "rgb(255, 99, 132)",
  orange: "rgb(255, 159, 64)",
  yellow: "rgb(255, 205, 86)",
  green: "rgb(75, 192, 192)",
  blue: "rgb(54, 162, 235)",
  purple: "rgb(153, 102, 255)",
  grey: "rgb(201, 203, 207)",
};

const NAMED_COLORS = [
  CHART_COLORS.red,
  CHART_COLORS.orange,
  CHART_COLORS.yellow,
  CHART_COLORS.green,
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.grey,
];

export function namedColor(index) {
  return NAMED_COLORS[index % NAMED_COLORS.length];
}


export function groupAndSum(arr, groupKeys, sumKeys) {
  return Object.values(
    arr.reduce((acc, curr) => {
      const group = groupKeys.map((k) => curr[k]).join("-");
      acc[group] =
        acc[group] ||
        Object.fromEntries(
          groupKeys
            .map((k) => [k, curr[k]])
            .concat(sumKeys.map((k) => [k, 0]))
        );
      sumKeys.forEach((k) => (acc[group][k] += curr[k]));
      return acc;
    }, {})
  );
}

export function getShiftType(dateTime) {
  //--- compare time for set Shift ---//
  let shift
  let time = moment(dateTime, "HH:mm:ss")
  let shiftA = moment("07:00:00", "HH:mm:ss")._d
  let shiftB = moment("15:00:00", "HH:mm:ss")._d
  let shiftC = moment("23:00:00", "HH:mm:ss")._d
  if (time >= shiftA && time < shiftB) {
    shift = "A"
  } else if (time >= shiftB && time < shiftC) {
    shift = "B"
  } else {
    shift = "C"
  }

  return shift;
}

export function makeid(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}